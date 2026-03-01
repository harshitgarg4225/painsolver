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

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: authHeader(input.apiKey),
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Freshdesk API failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
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
