const EMBEDDING_DIMENSION = 256;

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash << 5) - hash + token.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function deterministicEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\\s]/g, " ")
    .split(/\\s+/)
    .filter(Boolean);

  for (const token of tokens) {
    const idx = hashToken(token) % EMBEDDING_DIMENSION;
    vector[idx] += 1;
  }

  const norm = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const limit = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < limit; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function jaccardSimilarity(aText: string, bText: string): number {
  const a = new Set(aText.toLowerCase().split(/\\W+/).filter(Boolean));
  const b = new Set(bText.toLowerCase().split(/\\W+/).filter(Boolean));

  const union = new Set([...a, ...b]);
  if (union.size === 0) {
    return 0;
  }

  let intersectionCount = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersectionCount += 1;
    }
  }

  return intersectionCount / union.size;
}
