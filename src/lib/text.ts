const htmlEntityMap: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " "
};

export function stripHtml(raw: string): string {
  const withoutTags = raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  const decoded = withoutTags.replace(
    /&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g,
    (entity) => htmlEntityMap[entity] ?? entity
  );

  return decoded.replace(/\s+/g, " ").trim();
}

export function getCompanyNameFromEmail(email: string): string {
  const domain = email.toLowerCase().split("@")[1] ?? "unknown-company";
  return domain.replace(/\.[a-z]{2,}$/i, "").replace(/[^a-z0-9-]/gi, "-");
}
