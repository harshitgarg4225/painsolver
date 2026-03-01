const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}/g;
const API_KEY_REGEXES = [
  /sk-[A-Za-z0-9]{20,}/g,
  /(?:api[_-]?key|token|secret)\s*[:=]\s*["']?[A-Za-z0-9_.-]{12,}["']?/gi,
  /Bearer\s+[A-Za-z0-9_.-]{16,}/gi
];

export function scrubPii(rawText: string): string {
  let cleaned = rawText.replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
  cleaned = cleaned.replace(PHONE_REGEX, "[REDACTED_PHONE]");

  for (const regex of API_KEY_REGEXES) {
    cleaned = cleaned.replace(regex, "[REDACTED_SECRET]");
  }

  return cleaned;
}
