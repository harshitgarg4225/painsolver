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
