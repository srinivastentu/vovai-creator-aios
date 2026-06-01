// Stage-5 (Repurpose) context assembly — shared by the CLI (pipeline-produce) and
// the Gate B regenerate runner (regenerate-runner). Maps a Long-Form Master row +
// its persona JSON into the RepurposeContext the cross-critique loop consumes and
// the personaContext block the Gemini judge grades persona/audience fit against.
//
// Structural (not Prisma-typed) inputs so both callers fit — the CLI's own
// PrismaClient and the app `db` select the same fields.

import type { ArtifactKind, ProducerPersona, RepurposeContext } from "./types"

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
}
function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
}

/** The persona JSON columns the producers + judge read (CreatorPersona row). */
export interface PersonaJson {
  name: string
  voiceTone: unknown
  audienceProfile: unknown
  creatorProfile: unknown
}

/** Map a CreatorPersona row's JSON columns into the compact ProducerPersona view. */
export function toProducerPersona(persona: PersonaJson): ProducerPersona {
  const voice = asRecord(persona.voiceTone)
  const audience = asRecord(persona.audienceProfile)
  const creator = asRecord(persona.creatorProfile)
  return {
    name: persona.name,
    voiceSummary: [str(voice.formality), str(voice.vocabulary), str(voice.sentenceRhythm)]
      .filter(Boolean)
      .join(" "),
    pointOfView: str(creator.pointOfView),
    audienceSummary: [
      str(audience.primaryRole),
      str(audience.experienceLevel),
      str(audience.whatTheyWant),
    ]
      .filter(Boolean)
      .join(" — "),
    signaturePhrases: strArr(voice.signaturePhrases),
    signatureHooks: strArr(creator.signatureHooks),
    doNotSay: strArr(voice.doNotSay),
  }
}

/** Persona block the Gemini judge grades personaFit / audienceFit against. */
export function renderPersonaContext(p: ProducerPersona): string {
  return [
    `Name: ${p.name}`,
    p.voiceSummary ? `Voice: ${p.voiceSummary}` : "",
    p.pointOfView ? `Point of view: ${p.pointOfView}` : "",
    p.audienceSummary ? `Audience: ${p.audienceSummary}` : "",
    p.doNotSay.length ? `Never say: ${p.doNotSay.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

/** Structural Long-Form Master row (the fields the Repurpose context needs). */
export interface RepurposeMasterRow {
  id: string
  title: string
  idea: { title: string; niches: string[] }
  sections: { heading: string; contentMarkdown: string }[]
  persona: PersonaJson
}

/** Build the RepurposeContext + judge personaContext for a master + artifact type. */
export function buildRepurposeContext(
  master: RepurposeMasterRow,
  type: ArtifactKind,
): { context: RepurposeContext; personaContext: string } {
  const persona = toProducerPersona(master.persona)
  const context: RepurposeContext = {
    longFormMasterId: master.id,
    artifactType: type,
    masterTitle: master.title,
    ideaTitle: master.idea.title,
    niches: master.idea.niches,
    persona,
    sections: master.sections.map((s) => ({
      heading: s.heading,
      contentMarkdown: s.contentMarkdown,
    })),
  }
  return { context, personaContext: renderPersonaContext(persona) }
}
