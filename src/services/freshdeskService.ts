import { env } from "../config/env";
import { stripHtml } from "../lib/text";

interface FreshdeskTicketFieldApi {
  name?: string;
  label?: string;
  type?: string;
  choices?: Record<string, string> | string[];
}

interface FreshdeskTicketApi {
  id?: number | string;
  subject?: string;
  description?: string;
  description_text?: string;
  email?: string;
  requester_email?: string;
  requester?: {
    email?: string;
    name?: string;
  };
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
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

const FRESHDESK_MAX_RETRIES = 3;
const FRESHDESK_BASE_DELAY_MS = 1000;

async function fetchFreshdeskJson<T>(input: {
  domain: string;
  apiKey: string;
  path: string;
  query?: Record<string, string>;
}): Promise<T> {
  const url = new URL(`${normalizeFreshdeskDomain(input.domain)}${input.path}`);
  Object.entries(input.query ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= FRESHDESK_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = FRESHDESK_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: authHeader(input.apiKey),
        "Content-Type": "application/json"
      }
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    // Retry on rate limit (429) and server errors (5xx)
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter && attempt < FRESHDESK_MAX_RETRIES) {
        const waitMs = parseInt(retryAfter, 10) * 1000;
        if (!isNaN(waitMs) && waitMs > 0 && waitMs <= 30000) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
      }
      lastError = new Error(`Freshdesk API failed (${response.status})`);
      console.warn(`[Freshdesk] API ${response.status} on ${input.path}, attempt ${attempt + 1}/${FRESHDESK_MAX_RETRIES + 1}`);
      continue;
    }

    // Non-retryable error
    const errorText = await response.text();
    throw new Error(`Freshdesk API failed (${response.status}): ${errorText}`);
  }

  throw lastError || new Error("Freshdesk API failed after retries");
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
