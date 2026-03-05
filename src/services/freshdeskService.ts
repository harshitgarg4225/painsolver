import { env } from "../config/env";
import { stripHtml } from "../lib/text";

// Rate limiting: max 50 requests per minute for Freshdesk
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1200; // ~50 req/min

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// Retry logic for transient failures
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isRetryable = 
        lastError.message.includes("429") || // Rate limit
        lastError.message.includes("503") || // Service unavailable
        lastError.message.includes("ETIMEDOUT") ||
        lastError.message.includes("ECONNRESET");
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      console.warn(`[Freshdesk] Attempt ${attempt} failed, retrying in ${delayMs}ms:`, lastError.message);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}

interface FreshdeskTicketFieldApi {
  name?: string;
  label?: string;
  type?: string;
  choices?: Record<string, string> | string[];
}

export interface FreshdeskTicketFieldOption {
  key: string;
  label: string;
  type: string;
  choices: string[];
}

export interface FreshdeskTicketImportItem {
  sourceReferenceId: string;
  requesterEmail: string;
  requesterName?: string;
  description: string;
  rawTicket: Record<string, unknown>;
}

export interface FreshdeskConnectionStatusView {
  connected: boolean;
  domain: string | null;
  hasApiKey: boolean;
  filterField: string | null;
  filterValue: string | null;
  lastFieldSyncAt: string | null;
  lastTicketSyncAt: string | null;
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:X`).toString("base64")}`;
}

function normalizeChoiceValues(rawChoices: Record<string, string> | string[] | undefined): string[] {
  if (!rawChoices) {
    return [];
  }

  if (Array.isArray(rawChoices)) {
    return rawChoices.map((choice) => String(choice));
  }

  return Object.values(rawChoices).map((choice) => String(choice));
}

function normalizeTicketDescription(ticket: FreshdeskTicketApi): string {
  const raw = String(ticket.description_text ?? ticket.description ?? ticket.subject ?? "").trim();
  return stripHtml(raw).replace(/\s+/g, " ").trim();
}

function parseTicketToImportItem(ticket: FreshdeskTicketApi): FreshdeskTicketImportItem | null {
  const id = ticket.id == null ? "" : String(ticket.id);
  if (!id) {
    return null;
  }

  const description = normalizeTicketDescription(ticket);
  if (!description) {
    return null;
  }

  const requesterEmail = String(
    ticket.requester?.email ?? ticket.email ?? ticket.requester_email ?? `freshdesk+${id}@unknown.local`
  )
    .trim()
    .toLowerCase();

  const requesterName = String(ticket.requester?.name ?? "").trim() || undefined;

  return {
    sourceReferenceId: id,
    requesterEmail,
    requesterName,
    description,
    rawTicket: ticket as Record<string, unknown>
  };
}

export function normalizeFreshdeskDomain(domain: string): string {
  const normalized = String(domain || "").trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("Freshdesk domain is required.");
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return `https://${normalized}`;
}

function getNestedValue(payload: unknown, path: string): unknown {
  const cleanPath = String(path || "").trim();
  if (!cleanPath) {
    return undefined;
  }

  return cleanPath.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      const record = current as Record<string, unknown>;
      return record[part];
    }
    return undefined;
  }, payload);
}

function valueTokens(value: unknown): string[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => valueTokens(item))
      .filter(Boolean);
  }

  if (typeof value === "object") {
    return [JSON.stringify(value).toLowerCase()];
  }

  return [String(value).trim().toLowerCase()];
}

export function matchesFreshdeskFieldFilter(input: {
  payload: unknown;
  filterField?: string | null;
  filterValue?: string | null;
}): boolean {
  const filterField = String(input.filterField ?? "").trim();
  const filterValue = String(input.filterValue ?? "").trim();

  if (!filterField || !filterValue) {
    return true;
  }

  const expectedValues = filterValue
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (!expectedValues.length) {
    return true;
  }

  const actualValue = getNestedValue(input.payload, filterField);
  const actualTokens = valueTokens(actualValue);
  if (!actualTokens.length) {
    return false;
  }

  return expectedValues.some((expected) => actualTokens.includes(expected));
}

export function statusFromFreshdeskConfig(config: {
  freshdeskDomain: string | null;
  freshdeskApiKey: string | null;
  freshdeskFilterField: string | null;
  freshdeskFilterValue: string | null;
  freshdeskLastFieldSyncAt: Date | null;
  freshdeskLastTicketSyncAt: Date | null;
} | null): FreshdeskConnectionStatusView {
  if (!config) {
    return {
      connected: false,
      domain: null,
      hasApiKey: false,
      filterField: null,
      filterValue: null,
      lastFieldSyncAt: null,
      lastTicketSyncAt: null
    };
  }

  const hasApiKey = Boolean(config.freshdeskApiKey);
  const hasDomain = Boolean(config.freshdeskDomain);

  return {
    connected: hasApiKey && hasDomain,
    domain: config.freshdeskDomain,
    hasApiKey,
    filterField: config.freshdeskFilterField,
    filterValue: config.freshdeskFilterValue,
    lastFieldSyncAt: config.freshdeskLastFieldSyncAt
      ? config.freshdeskLastFieldSyncAt.toISOString()
      : null,
    lastTicketSyncAt: config.freshdeskLastTicketSyncAt
      ? config.freshdeskLastTicketSyncAt.toISOString()
      : null
  };
}

function mockFields(): FreshdeskTicketFieldOption[] {
  return [
    { key: "status", label: "Status", type: "status", choices: ["2", "3", "4", "5"] },
    { key: "priority", label: "Priority", type: "priority", choices: ["1", "2", "3", "4"] },
    { key: "type", label: "Type", type: "type", choices: ["Incident", "Question", "Feature Request"] },
    { key: "source", label: "Source", type: "source", choices: ["2", "3", "7"] },
    { key: "group_id", label: "Group", type: "number", choices: [] },
    { key: "custom_fields.cf_area", label: "Area", type: "custom_text", choices: [] },
    { key: "custom_fields.cf_plan", label: "Plan", type: "custom_dropdown", choices: ["Starter", "Pro", "Enterprise"] }
  ];
}

function mockTickets(): FreshdeskTicketImportItem[] {
  const tickets: FreshdeskTicketApi[] = [
    {
      id: 91001,
      email: "wilberth@acmeagency.com",
      requester: {
        name: "Wilberth Martinez"
      },
      subject: "Need planner comments parity",
      description_text: "Comments are missing for posts scheduled directly in Meta.",
      status: 2,
      priority: 2,
      custom_fields: {
        cf_area: "Planner",
        cf_plan: "Enterprise"
      }
    },
    {
      id: 91002,
      email: "ops@orbitcommerce.com",
      requester: {
        name: "Orbit Ops"
      },
      subject: "Competitor board analytics request",
      description_text: "Please add built in competitor analytics by account.",
      status: 2,
      priority: 1,
      custom_fields: {
        cf_area: "Analytics",
        cf_plan: "Pro"
      }
    }
  ];

  return tickets
    .map((ticket) => parseTicketToImportItem(ticket))
    .filter((ticket): ticket is FreshdeskTicketImportItem => Boolean(ticket));
}

async function fetchFreshdeskJson<T>(input: {
  domain: string;
  apiKey: string;
  path: string;
  query?: Record<string, string>;
  method?: "GET" | "POST" | "PUT";
  body?: Record<string, unknown>;
}): Promise<T> {
  return withRetry(async () => {
    await rateLimit();
    
    const url = new URL(`${normalizeFreshdeskDomain(input.domain)}${input.path}`);
    Object.entries(input.query ?? {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      method: input.method || "GET",
      headers: {
        Authorization: authHeader(input.apiKey),
        "Content-Type": "application/json"
      },
      body: input.body ? JSON.stringify(input.body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Freshdesk API failed (${response.status}): ${errorText}`);
    }

    return (await response.json()) as T;
  });
}

export async function listFreshdeskTicketFields(input: {
  domain: string;
  apiKey: string;
}): Promise<FreshdeskTicketFieldOption[]> {
  if (env.USE_MOCK_FRESHDESK) {
    return mockFields();
  }

  const baseFields: FreshdeskTicketFieldOption[] = [
    { key: "status", label: "Status", type: "status", choices: [] },
    { key: "priority", label: "Priority", type: "priority", choices: [] },
    { key: "type", label: "Type", type: "type", choices: [] },
    { key: "source", label: "Source", type: "source", choices: [] },
    { key: "group_id", label: "Group", type: "number", choices: [] },
    { key: "product_id", label: "Product", type: "number", choices: [] },
    { key: "company_id", label: "Company", type: "number", choices: [] }
  ];

  const apiFields = await fetchFreshdeskJson<FreshdeskTicketFieldApi[]>({
    domain: input.domain,
    apiKey: input.apiKey,
    path: "/api/v2/ticket_fields"
  });

  const normalized = apiFields
    .map((field) => {
      const name = String(field.name ?? "").trim();
      if (!name) {
        return null;
      }

      const isCustom = name.startsWith("cf_");
      return {
        key: isCustom ? `custom_fields.${name}` : name,
        label: String(field.label ?? name),
        type: String(field.type ?? "text"),
        choices: normalizeChoiceValues(field.choices)
      } satisfies FreshdeskTicketFieldOption;
    })
    .filter((field): field is FreshdeskTicketFieldOption => Boolean(field));

  const deduped = new Map<string, FreshdeskTicketFieldOption>();
  baseFields.concat(normalized).forEach((field) => {
    if (!deduped.has(field.key)) {
      deduped.set(field.key, field);
    }
  });

  return Array.from(deduped.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export async function listFreshdeskTickets(input: {
  domain: string;
  apiKey: string;
  daysBack?: number;
  maxTickets?: number;
}): Promise<FreshdeskTicketImportItem[]> {
  if (env.USE_MOCK_FRESHDESK) {
    return mockTickets();
  }

  const daysBack = Math.max(1, Math.min(365, input.daysBack ?? 30));
  const maxTickets = Math.max(1, Math.min(300, input.maxTickets ?? 100));
  const updatedSince = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const perPage = Math.min(100, maxTickets);

  const tickets: FreshdeskTicketImportItem[] = [];
  let page = 1;

  while (tickets.length < maxTickets) {
    const pageItems = await fetchFreshdeskJson<FreshdeskTicketApi[]>({
      domain: input.domain,
      apiKey: input.apiKey,
      path: "/api/v2/tickets",
      query: {
        per_page: String(perPage),
        page: String(page),
        order_by: "updated_at",
        order_type: "desc",
        updated_since: updatedSince
      }
    });

    if (!Array.isArray(pageItems) || pageItems.length === 0) {
      break;
    }

    pageItems.forEach((ticket) => {
      if (tickets.length >= maxTickets) {
        return;
      }

      const parsed = parseTicketToImportItem(ticket);
      if (parsed) {
        tickets.push(parsed);
      }
    });

    if (pageItems.length < perPage) {
      break;
    }

    page += 1;
  }

  return tickets;
}

// =============================================
// Freshdesk Conversation & Bi-directional Sync
// =============================================

interface FreshdeskConversation {
  id: number;
  body: string;
  body_text: string;
  incoming: boolean;
  user_id: number;
  created_at: string;
}

/**
 * Fetch full conversation thread for a ticket
 */
export async function fetchFreshdeskTicketConversation(input: {
  domain: string;
  apiKey: string;
  ticketId: string;
}): Promise<string[]> {
  if (env.USE_MOCK_FRESHDESK) {
    return [
      "Customer: I'm having trouble with the reporting feature.",
      "Agent: Can you describe the issue in more detail?",
      "Customer: The weekly report doesn't include the new metrics we added last month."
    ];
  }

  try {
    const conversations = await fetchFreshdeskJson<FreshdeskConversation[]>({
      domain: input.domain,
      apiKey: input.apiKey,
      path: `/api/v2/tickets/${input.ticketId}/conversations`
    });

    return conversations.map((conv) => {
      const text = stripHtml(conv.body_text || conv.body || "").trim();
      const prefix = conv.incoming ? "Customer" : "Agent";
      return `${prefix}: ${text}`;
    });
  } catch (error) {
    console.error("Failed to fetch Freshdesk conversation:", error);
    return [];
  }
}

/**
 * Get single ticket details
 */
export async function fetchFreshdeskTicket(input: {
  domain: string;
  apiKey: string;
  ticketId: string;
}): Promise<FreshdeskTicketImportItem | null> {
  if (env.USE_MOCK_FRESHDESK) {
    return {
      sourceReferenceId: input.ticketId,
      requesterEmail: "mock@example.com",
      requesterName: "Mock User",
      description: "Mock ticket description",
      rawTicket: { id: input.ticketId }
    };
  }

  try {
    const ticket = await fetchFreshdeskJson<FreshdeskTicketApi>({
      domain: input.domain,
      apiKey: input.apiKey,
      path: `/api/v2/tickets/${input.ticketId}`
    });

    return parseTicketToImportItem(ticket);
  } catch (error) {
    console.error("Failed to fetch Freshdesk ticket:", error);
    return null;
  }
}

/**
 * Add a note to a Freshdesk ticket (bi-directional sync)
 */
export async function addFreshdeskTicketNote(input: {
  domain: string;
  apiKey: string;
  ticketId: string;
  body: string;
  isPrivate?: boolean;
}): Promise<boolean> {
  if (env.USE_MOCK_FRESHDESK) {
    console.log(`[Freshdesk Mock] Would add note to ticket ${input.ticketId}: ${input.body}`);
    return true;
  }

  try {
    const url = `${normalizeFreshdeskDomain(input.domain)}/api/v2/tickets/${input.ticketId}/notes`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(input.apiKey),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        body: input.body,
        private: input.isPrivate !== false // Default to private note
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Freshdesk note API failed (${response.status}): ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to add Freshdesk note:", error);
    return false;
  }
}

/**
 * Update Freshdesk ticket status (for bi-directional sync)
 * Freshdesk status values: 2=Open, 3=Pending, 4=Resolved, 5=Closed
 */
export async function updateFreshdeskTicketStatus(input: {
  domain: string;
  apiKey: string;
  ticketId: string;
  status: number;
}): Promise<boolean> {
  if (env.USE_MOCK_FRESHDESK) {
    console.log(`[Freshdesk Mock] Would update ticket ${input.ticketId} status to ${input.status}`);
    return true;
  }

  try {
    const url = `${normalizeFreshdeskDomain(input.domain)}/api/v2/tickets/${input.ticketId}`;
    
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: authHeader(input.apiKey),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: input.status
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Freshdesk status update failed (${response.status}): ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to update Freshdesk ticket status:", error);
    return false;
  }
}

/**
 * Webhook payload from Freshdesk
 */
export interface FreshdeskWebhookPayload {
  ticket_id?: number | string;
  ticket_subject?: string;
  ticket_description?: string;
  ticket_description_text?: string;
  requester_email?: string;
  requester_name?: string;
  ticket_status?: string | number;
  ticket_priority?: string | number;
  ticket_type?: string;
  ticket_source?: string | number;
  triggered_event?: string;
  // Custom fields come as ticket_cf_*
  [key: string]: unknown;
}

/**
 * Parse webhook payload to import item
 */
export function parseWebhookPayload(payload: FreshdeskWebhookPayload): FreshdeskTicketImportItem | null {
  const ticketId = payload.ticket_id;
  if (!ticketId) {
    return null;
  }

  const description = stripHtml(
    String(payload.ticket_description_text || payload.ticket_description || payload.ticket_subject || "")
  ).trim();

  if (!description || description.length < 10) {
    return null;
  }

  const requesterEmail = String(payload.requester_email || `freshdesk+${ticketId}@unknown.local`)
    .trim()
    .toLowerCase();

  return {
    sourceReferenceId: String(ticketId),
    requesterEmail,
    requesterName: payload.requester_name ? String(payload.requester_name).trim() : undefined,
    description,
    rawTicket: payload as Record<string, unknown>
  };
}

/**
 * Map PainSolver status to Freshdesk status
 */
export function mapPainSolverStatusToFreshdesk(status: string): number | null {
  const mapping: Record<string, number> = {
    under_review: 2, // Open
    backlog: 2,      // Open
    planned: 3,      // Pending
    in_progress: 3,  // Pending
    complete: 4,     // Resolved
    shipped: 5       // Closed
  };
  return mapping[status] ?? null;
}

/**
 * Map Freshdesk priority to PainSolver urgency
 * Freshdesk priorities: 1=Low, 2=Medium, 3=High, 4=Urgent
 */
export function mapFreshdeskPriorityToUrgency(priority: number | string | undefined): "low" | "medium" | "high" | "critical" {
  const numPriority = Number(priority);
  if (numPriority === 4) return "critical";
  if (numPriority === 3) return "high";
  if (numPriority === 2) return "medium";
  return "low";
}

/**
 * Extract enriched metadata from Freshdesk ticket
 */
export function extractFreshdeskMetadata(ticket: Record<string, unknown>): {
  priority: "low" | "medium" | "high" | "critical";
  status: string;
  source: string;
  tags: string[];
  customFields: Record<string, unknown>;
} {
  const priorityNum = Number(ticket.priority ?? ticket.ticket_priority ?? 2);
  const statusNum = Number(ticket.status ?? ticket.ticket_status ?? 2);
  const sourceNum = Number(ticket.source ?? ticket.ticket_source ?? 2);
  
  const statusMap: Record<number, string> = {
    2: "open",
    3: "pending",
    4: "resolved",
    5: "closed"
  };
  
  const sourceMap: Record<number, string> = {
    1: "email",
    2: "portal",
    3: "phone",
    7: "chat",
    9: "feedback_widget",
    10: "outbound_email"
  };

  // Extract tags from ticket
  const rawTags = ticket.tags ?? ticket.ticket_tags ?? [];
  const tags = Array.isArray(rawTags) 
    ? rawTags.map(t => String(t).toLowerCase()) 
    : [];

  // Extract custom fields
  const customFields: Record<string, unknown> = {};
  Object.entries(ticket).forEach(([key, value]) => {
    if (key.startsWith("cf_") || key.startsWith("custom_fields.") || key.startsWith("ticket_cf_")) {
      const cleanKey = key.replace(/^(ticket_)?custom_fields\./, "").replace(/^ticket_/, "");
      customFields[cleanKey] = value;
    }
  });

  return {
    priority: mapFreshdeskPriorityToUrgency(priorityNum),
    status: statusMap[statusNum] ?? "open",
    source: sourceMap[sourceNum] ?? "unknown",
    tags,
    customFields
  };
}

/**
 * Get ticket statistics for activity display
 */
export async function getFreshdeskTicketStats(input: {
  domain: string;
  apiKey: string;
}): Promise<{
  totalTickets: number;
  openTickets: number;
  pendingTickets: number;
  recentlyUpdated: number;
}> {
  if (env.USE_MOCK_FRESHDESK) {
    return {
      totalTickets: 42,
      openTickets: 15,
      pendingTickets: 8,
      recentlyUpdated: 5
    };
  }

  try {
    // Get counts for different statuses
    const [openTickets, pendingTickets] = await Promise.all([
      fetchFreshdeskJson<{ total: number }>({
        domain: input.domain,
        apiKey: input.apiKey,
        path: "/api/v2/search/tickets",
        query: { query: '"status:2"' } // Open
      }).then(r => r.total).catch(() => 0),
      fetchFreshdeskJson<{ total: number }>({
        domain: input.domain,
        apiKey: input.apiKey,
        path: "/api/v2/search/tickets",
        query: { query: '"status:3"' } // Pending
      }).then(r => r.total).catch(() => 0)
    ]);

    // Get recently updated tickets (last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentlyUpdated = await fetchFreshdeskJson<FreshdeskTicketApi[]>({
      domain: input.domain,
      apiKey: input.apiKey,
      path: "/api/v2/tickets",
      query: {
        updated_since: yesterday,
        per_page: "1"
      }
    }).then(r => r.length).catch(() => 0);

    return {
      totalTickets: openTickets + pendingTickets,
      openTickets,
      pendingTickets,
      recentlyUpdated
    };
  } catch (error) {
    console.error("Failed to get Freshdesk stats:", error);
    return {
      totalTickets: 0,
      openTickets: 0,
      pendingTickets: 0,
      recentlyUpdated: 0
    };
  }
}

interface FreshdeskTicketApi {
  id?: number | string;
  subject?: string;
  description?: string;
  description_text?: string;
  email?: string;
  requester_email?: string;
  priority?: number;
  status?: number;
  source?: number;
  tags?: string[];
  requester?: {
    email?: string;
    name?: string;
  };
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
}
