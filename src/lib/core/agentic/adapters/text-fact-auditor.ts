// Fact-auditor adapter: extracts and classifies verifiable claims in text.
// Runs before the judge; its output is folded into the judge's user message
// and (when likely-wrong claims exist) caps accuracy at 6.5 in code.

import OpenAI from 'openai'
import { createHash } from 'node:crypto'
import { calculateCost } from '../pricing'

export type FactVerdict =
  | 'verified-canonical'
  | 'plausible-uncited'
  | 'likely-wrong'
  | 'unverifiable'

export interface FactClaim {
  text: string
  kind: 'date' | 'number' | 'named' | 'case'
  verdict: FactVerdict
  reason: string
}

export interface FactAudit {
  claims: FactClaim[]
  likelyWrongCount: number
  unverifiableRatio: number
}

export interface FactAuditorCostEvent {
  model: string
  tokensIn: number
  tokensOut: number
  costUSD: number
}

export interface FactAuditorOptions {
  model?: string
  client?: Pick<OpenAI, 'chat'>
  onCost?: (event: FactAuditorCostEvent) => void
}

const DEFAULT_MODEL = 'gpt-4o-mini'

const SYSTEM_PROMPT = [
  'You are a fact auditor. Extract every verifiable claim in <artifact> and classify each one.',
  '',
  'Extract ONLY these claim kinds:',
  '- date: a specific year, month, or date',
  '- number: a numeric figure, statistic, percentage, quantity',
  '- named: a named person, organization, study, paper, or case',
  '- case: a specific named event, legal case, or incident',
  '',
  'Verdicts:',
  '- verified-canonical: widely-known and almost certainly correct (e.g. 1776 US independence)',
  '- plausible-uncited: could be true but lacks a source; ambiguity is fine',
  '- likely-wrong: you believe this is factually incorrect (give your reasoning)',
  '- unverifiable: citation-shaped but names no primary source (e.g. "studies suggest")',
  '',
  'Be conservative with likely-wrong — only flag when you are confident the claim is false.',
  'Return ONLY a JSON object: { "claims": [ { "text": "...", "kind": "...", "verdict": "...", "reason": "..." }, ... ] }',
].join('\n')

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*\n?/gm, '').replace(/\n?```\s*$/gm, '').trim()
}

function seedFromContent(content: string): number {
  const hash = createHash('sha256').update(content).digest()
  return hash.readUInt32BE(0) & 0x7fffffff
}

export function createTextFactAuditor(
  opts: FactAuditorOptions = {}
): (artifact: string) => Promise<FactAudit> {
  const model = opts.model ?? DEFAULT_MODEL
  const onCost = opts.onCost
  const client: Pick<OpenAI, 'chat'> =
    opts.client ??
    (() => {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set — cannot create fact auditor')
      }
      return new OpenAI({ apiKey })
    })()

  return async (artifact: string): Promise<FactAudit> => {
    const userMessage = `<artifact>\n${artifact}\n</artifact>`
    const seed = seedFromContent(artifact)
    let text = ''
    let tokensIn = 0
    let tokensOut = 0
    try {
      const res = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          seed,
        },
        { timeout: 60_000 }
      )
      text = res.choices[0]?.message?.content ?? ''
      tokensIn = res.usage?.prompt_tokens ?? 0
      tokensOut = res.usage?.completion_tokens ?? 0
    } catch {
      onCost?.({ model, tokensIn: 0, tokensOut: 0, costUSD: 0 })
      return { claims: [], likelyWrongCount: 0, unverifiableRatio: 0 }
    }

    const costUSD = calculateCost(model, tokensIn, tokensOut)
    onCost?.({ model, tokensIn, tokensOut, costUSD })

    let parsed: { claims?: FactClaim[] } = {}
    try {
      parsed = JSON.parse(stripFences(text))
    } catch {
      return { claims: [], likelyWrongCount: 0, unverifiableRatio: 0 }
    }
    const claims = Array.isArray(parsed.claims) ? parsed.claims : []
    const likelyWrongCount = claims.filter((c) => c.verdict === 'likely-wrong').length
    const unverifiable = claims.filter((c) => c.verdict === 'unverifiable').length
    const unverifiableRatio = claims.length === 0 ? 0 : unverifiable / claims.length
    return { claims, likelyWrongCount, unverifiableRatio }
  }
}

export function formatFactAuditForJudge(audit: FactAudit): string {
  if (audit.claims.length === 0) return '<fact-audit>no claims extracted</fact-audit>'
  const lines = audit.claims.map(
    (c) => `- [${c.verdict}] (${c.kind}) "${c.text}" — ${c.reason}`
  )
  return [
    '<fact-audit>',
    `likelyWrongCount=${audit.likelyWrongCount} unverifiableRatio=${audit.unverifiableRatio.toFixed(2)}`,
    ...lines,
    '</fact-audit>',
  ].join('\n')
}
