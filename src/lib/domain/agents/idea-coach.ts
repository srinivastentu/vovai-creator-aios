// Idea Coach (Stage 1, optional) — a single LLM pass, no rubric gate.
//
// Given an umbrella topic + niche + persona context, it proposes 3–5 specific,
// publishable titles, each with a one-line angle. It routes through the MMS
// gateway (capability 'text-generation') rather than calling a model SDK
// directly, so the call lands in the Core cost ledger tagged 'idea-coach'.
//
// NOTE: the CR-9 spec sketched `executeAgent` from a `core/agentic/executor`
// module; this repo has no such helper. The real agent-execution path is the
// MMS gateway (used by every existing agent, e.g. the Gemini judge), so this
// implements the spec's intent — single pass, MMS + cost ledger, schema
// validation with one repair re-prompt — in the repo's actual machinery.
//
// Domain → Core import only (allowed). Server-only: the sole client import is
// the `IdeaProposal` *type* (erased at build), so the gateway never ships to
// the browser.

import { z } from "zod"
import type { ModelGateway } from "@/lib/core/models/gateway"
import { getDefaultGateway } from "@/lib/core/models/default-gateway"

export const ProposalSchema = z.object({
  title: z.string().min(8).max(120),
  angle: z.string().min(10).max(240),
})
export const CoachResultSchema = z.object({
  proposals: z.array(ProposalSchema).min(3).max(5),
})
export type IdeaProposal = z.infer<typeof ProposalSchema>
export type CoachResult = z.infer<typeof CoachResultSchema>

// MMS resolves this to the concrete provider model (anthropic). Registered for
// 'text-generation' in the model inventory (CR-7).
const COACH_MODEL = "claude-sonnet-4-20250514"

const SYSTEM_PROMPT =
  "You are Idea Coach. Given an umbrella topic and a niche, propose 3–5 " +
  "specific, publishable content titles for this creator. Each needs a one-line " +
  "angle. Match the persona's audience and voice. No hashtags, no emoji. " +
  "Return JSON only, with no prose and no code fences: " +
  '{ "proposals": [{ "title": "…", "angle": "…" }] }.'

export interface CoachInput {
  umbrella: string
  niche: string
  persona: { name: string; audienceProfile: unknown; voiceTone: unknown }
  workspaceId: string
}

export interface CoachDeps {
  gateway?: ModelGateway
}

function buildUserPrompt(input: CoachInput, repair?: string): string {
  const base = JSON.stringify({
    umbrella: input.umbrella,
    niche: input.niche,
    persona: input.persona,
  })
  if (!repair) return base
  return `${base}\n\n${repair} Return ONLY the corrected JSON.`
}

// Tolerant parse: strip code fences / surrounding prose, take the outermost
// JSON object, then validate against the schema. Returns null on any failure.
function parseResult(content: string): CoachResult | null {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  let json: unknown
  try {
    json = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
  const parsed = CoachResultSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

export async function coachIdeas(
  input: CoachInput,
  deps: CoachDeps = {},
): Promise<CoachResult> {
  const gateway = deps.gateway ?? getDefaultGateway()

  async function call(repair?: string): Promise<string> {
    const res = await gateway.request({
      capability: "text-generation",
      preferences: { modelId: COACH_MODEL },
      params: {
        prompt: buildUserPrompt(input, repair),
        systemPrompt: SYSTEM_PROMPT,
        maxOutputTokens: 1024,
      },
      context: {
        callerTag: "idea-coach",
        projectId: input.workspaceId,
        stageId: "idea-coach",
      },
    })
    const content = res.result?.content
    return typeof content === "string" ? content : ""
  }

  const first = parseResult(await call())
  if (first) return first

  // One repair re-prompt before giving up (the executor's repair pass).
  const second = parseResult(
    await call(
      "Your previous reply was not valid. Reply with a single JSON object " +
        "{ \"proposals\": [...] } containing 3 to 5 items, each with a 'title' " +
        "(8–120 chars) and an 'angle' (10–240 chars).",
    ),
  )
  if (second) return second

  throw new Error("idea_coach_invalid_output")
}
