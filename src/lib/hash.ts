import crypto from "crypto";

export function buildIdentifyPayload(user: unknown, company: unknown): string {
  return JSON.stringify({ user, company });
}

export function signIdentifyPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyHmacSignature(
  payload: string,
  providedHash: string,
  secret: string
): boolean {
  if (!/^[a-fA-F0-9]{64}$/.test(providedHash)) {
    return false;
  }

  const expected = signIdentifyPayload(payload, secret);
  const provided = Buffer.from(providedHash, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (provided.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expectedBuffer);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64").toString("utf8");
}

function signTokenSegment(segment: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(segment)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch (_error) {
    return null;
  }
}

export interface SignedSdkTokenPayload {
  type: "board" | "sso";
  exp: number;
  boardId?: string;
  identify?: {
    user: {
      email: string;
      name?: string;
      appUserId?: string;
    };
    company: {
      name: string;
      monthlySpend?: number;
      healthStatus?: string;
      stripeCustomerId?: string;
    };
  };
}

export function signSdkToken(payload: SignedSdkTokenPayload, secret: string): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signTokenSegment(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySdkToken(
  token: string,
  secret: string
): { valid: true; payload: SignedSdkTokenPayload } | { valid: false } {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) {
    return { valid: false };
  }

  const encodedPayload = parts[0];
  const providedSignature = parts[1];
  const expectedSignature = signTokenSegment(encodedPayload, secret);
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return { valid: false };
  }

  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return { valid: false };
  }

  const decoded = safeJsonParse<SignedSdkTokenPayload>(base64UrlDecode(encodedPayload));
  if (!decoded || typeof decoded !== "object" || !decoded.type || typeof decoded.exp !== "number") {
    return { valid: false };
  }

  if (decoded.exp * 1000 < Date.now()) {
    return { valid: false };
  }

  return {
    valid: true,
    payload: decoded
  };
}
