// Embedding-based similarity helper (CR-7).
// Used by pipeline-produce.ts to mechanize the acceptance check from
// docs/03-decisions/creator-decisions-log.md: cosine similarity between
// consecutive cross-critique integrated artifacts must be ≤ 0.92 (a warning, not
// a gate — higher similarity signals producers stuck / feedback ignored).
//
// Embeddings via OpenAI text-embedding-3-large (the model the decision names).
// CR-12 lifts this into tests/e2e/helpers/embedding-distance.ts for the formal
// acceptance test; the math + model choice stay identical.

import OpenAI from 'openai'

export const EMBEDDING_MODEL = 'text-embedding-3-large'

/** Cosine similarity of two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/** Embed a batch of texts with text-embedding-3-large. Requires OPENAI_API_KEY. */
export async function embedTexts(
  texts: string[],
  opts: { apiKey?: string; model?: string } = {},
): Promise<number[][]> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY required for embeddings')
  const client = new OpenAI({ apiKey })
  const res = await client.embeddings.create({
    model: opts.model ?? EMBEDDING_MODEL,
    input: texts,
  })
  return res.data.map((d) => d.embedding as number[])
}

/** Cosine similarity between each consecutive pair of texts. [] when < 2 texts. */
export async function consecutiveSimilarities(
  texts: string[],
  opts: { apiKey?: string; model?: string } = {},
): Promise<number[]> {
  if (texts.length < 2) return []
  const embeddings = await embedTexts(texts, opts)
  const sims: number[] = []
  for (let i = 1; i < embeddings.length; i++) {
    sims.push(cosineSimilarity(embeddings[i - 1], embeddings[i]))
  }
  return sims
}
