// CreatorPersona JSON sub-schemas + the persona form contract.
//
// Source of truth: docs/02-domain/buildos-persona.md (pinned in the
// decisions log 2026-05-31 as "the contract for CreatorPersona's Json
// columns AND the CR-9 persona CRUD forms"). NOTE: `formality` and
// `vocabulary` are free-text *descriptors* (strings), not a 0–1 slider —
// the CR-9 spec's "formality slider" assumed a numeric shape that the
// authoritative contract overrides. Honoring the contract keeps the
// seeded BuildOS persona (string formality) round-tripping and keeps the
// CR-4/CR-7 producers — which read these as descriptors — intact.
//
// Plain module (no "use server"): server actions, the API route, and the
// client PersonaForm all import the types/zod from here.

import { z } from "zod"

// NOTE: no zod `.default()` anywhere — the form supplies a full EMPTY_PERSONA
// as defaultValues, and `.default()` would make zod's *input* type diverge from
// its *output* type, breaking the react-hook-form resolver generics. Truly
// optional fields use `.optional()` (which keeps input === output).
export const VoiceToneSchema = z.object({
  formality: z.string(),
  vocabulary: z.string(),
  signaturePhrases: z.array(z.string()),
  doNotSay: z.array(z.string()),
  sentenceRhythm: z.string().optional(),
  emojiPolicy: z.string().optional(),
})

export const AudienceProfileSchema = z.object({
  primaryRole: z.string(),
  experienceLevel: z.string(),
  interests: z.array(z.string()),
  painPoints: z.array(z.string()),
  whatTheyWant: z.string(),
})

export const CreatorProfileSchema = z.object({
  name: z.string(),
  bio: z.string(),
  expertiseAreas: z.array(z.string()),
  pointOfView: z.string(),
  signatureHooks: z.array(z.string()),
  credibilityMarkers: z.array(z.string()),
})

// stage → rubric id (ids match docs/02-domain/rubrics.md). Read-only in V1.
export const DefaultRubricRefsSchema = z.object({
  research: z.string(),
  longFormMaster: z.string(),
  linkedinPost: z.string(),
  article: z.string(),
})

export const PersonaFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  niches: z.array(z.string()),
  voiceTone: VoiceToneSchema,
  audienceProfile: AudienceProfileSchema,
  creatorProfile: CreatorProfileSchema,
  defaultRubricRefs: DefaultRubricRefsSchema,
})

export type VoiceTone = z.infer<typeof VoiceToneSchema>
export type AudienceProfile = z.infer<typeof AudienceProfileSchema>
export type CreatorProfile = z.infer<typeof CreatorProfileSchema>
export type DefaultRubricRefs = z.infer<typeof DefaultRubricRefsSchema>
export type PersonaFormValues = z.infer<typeof PersonaFormSchema>

// Defaults for a brand-new persona (the form's defaultValues).
export const EMPTY_PERSONA: PersonaFormValues = {
  name: "",
  niches: [],
  voiceTone: { formality: "", vocabulary: "", signaturePhrases: [], doNotSay: [] },
  audienceProfile: {
    primaryRole: "",
    experienceLevel: "",
    interests: [],
    painPoints: [],
    whatTheyWant: "",
  },
  creatorProfile: {
    name: "",
    bio: "",
    expertiseAreas: [],
    pointOfView: "",
    signatureHooks: [],
    credibilityMarkers: [],
  },
  defaultRubricRefs: {
    research: "research-rubric",
    longFormMaster: "long-form-master-rubric",
    linkedinPost: "linkedin-post-rubric",
    article: "article-rubric",
  },
}

// Coerce a persisted CreatorPersona row (Json columns are `unknown`) into the
// form's value shape. Each sub-schema fills any missing keys with defaults; a
// malformed column falls back to its empty sub-object rather than throwing.
function safeSub<T>(schema: { parse: (v: unknown) => T }, value: unknown, fallback: T): T {
  try {
    return schema.parse(value ?? {})
  } catch {
    return fallback
  }
}

export function personaToFormValues(p: {
  name: string
  niches: string[]
  voiceTone: unknown
  audienceProfile: unknown
  creatorProfile: unknown
  defaultRubricRefs: unknown
}): PersonaFormValues {
  return {
    name: p.name,
    niches: Array.isArray(p.niches) ? p.niches : [],
    voiceTone: safeSub(VoiceToneSchema, p.voiceTone, EMPTY_PERSONA.voiceTone),
    audienceProfile: safeSub(AudienceProfileSchema, p.audienceProfile, EMPTY_PERSONA.audienceProfile),
    creatorProfile: safeSub(CreatorProfileSchema, p.creatorProfile, EMPTY_PERSONA.creatorProfile),
    defaultRubricRefs: safeSub(
      DefaultRubricRefsSchema,
      p.defaultRubricRefs,
      EMPTY_PERSONA.defaultRubricRefs,
    ),
  }
}
