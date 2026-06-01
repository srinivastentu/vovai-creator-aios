"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller, type Control, type FieldPathByValue } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  PersonaFormSchema,
  EMPTY_PERSONA,
  type PersonaFormValues,
} from "@/lib/domain/persona-schema"
import { createPersona, updatePersona } from "@/lib/domain/data/personas"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { NicheTagInput } from "@/components/common/NicheTagInput"
import { SaveBar } from "@/components/common/SaveBar"
import { VoiceToneFields } from "@/components/personas/VoiceToneFields"

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "creator", label: "Creator" },
  { id: "voice", label: "Voice" },
  { id: "audience", label: "Audience" },
  { id: "rubrics", label: "Rubrics" },
] as const

function TagField({
  control,
  name,
  placeholder,
}: {
  control: Control<PersonaFormValues>
  name: FieldPathByValue<PersonaFormValues, string[]>
  placeholder?: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <NicheTagInput value={field.value} onChange={field.onChange} placeholder={placeholder} />
      )}
    />
  )
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-border pb-8">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {description ? (
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      ) : (
        <div className="mb-4" />
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function PersonaForm({
  initial,
  personaId,
}: {
  initial?: PersonaFormValues
  personaId?: string
}) {
  const router = useRouter()
  const [saveError, setSaveError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<PersonaFormValues>({
    resolver: zodResolver(PersonaFormSchema),
    defaultValues: initial ?? EMPTY_PERSONA,
  })

  async function onValid(values: PersonaFormValues) {
    setSaveError(null)
    try {
      if (personaId) {
        await updatePersona(personaId, values)
      } else {
        await createPersona(values)
      }
      router.push("/personas")
      router.refresh()
    } catch {
      setSaveError("Could not save the persona. Your edits are preserved — try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="pb-24">
      <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
        {/* Jump-rail */}
        <nav className="hidden lg:block">
          <ul className="sticky top-10 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-8">
          <Section id="identity" title="Identity">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} placeholder="BuildOS Creator" />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Niches</Label>
              <TagField control={control} name="niches" placeholder="Add a niche…" />
            </div>
          </Section>

          <Section id="creator" title="Creator" description="Who this persona is.">
            <div className="space-y-1.5">
              <Label htmlFor="creatorProfile.name">Display name</Label>
              <Input id="creatorProfile.name" {...register("creatorProfile.name")} placeholder="Srinivas" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creatorProfile.bio">Bio</Label>
              <Textarea
                id="creatorProfile.bio"
                {...register("creatorProfile.bio")}
                placeholder="Founder building VOVAI in public…"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creatorProfile.pointOfView">Point of view</Label>
              <Textarea
                id="creatorProfile.pointOfView"
                {...register("creatorProfile.pointOfView")}
                placeholder="The recurring thesis every artifact ladders up to…"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expertise areas</Label>
              <TagField control={control} name="creatorProfile.expertiseAreas" placeholder="Add an area…" />
            </div>
            <div className="space-y-1.5">
              <Label>Signature hooks</Label>
              <TagField control={control} name="creatorProfile.signatureHooks" placeholder="Add a hook…" />
            </div>
            <div className="space-y-1.5">
              <Label>Credibility markers</Label>
              <TagField control={control} name="creatorProfile.credibilityMarkers" placeholder="Add a marker…" />
            </div>
          </Section>

          <Section id="voice" title="Voice &amp; tone" description="How this persona sounds.">
            <VoiceToneFields control={control} register={register} />
          </Section>

          <Section id="audience" title="Audience" description="Who this persona writes for.">
            <div className="space-y-1.5">
              <Label htmlFor="audienceProfile.primaryRole">Primary role</Label>
              <Input
                id="audienceProfile.primaryRole"
                {...register("audienceProfile.primaryRole")}
                placeholder="AI builders and software engineers…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audienceProfile.experienceLevel">Experience level</Label>
              <Input
                id="audienceProfile.experienceLevel"
                {...register("audienceProfile.experienceLevel")}
                placeholder="Intermediate-to-senior developers who ship"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audienceProfile.whatTheyWant">What they want</Label>
              <Textarea
                id="audienceProfile.whatTheyWant"
                {...register("audienceProfile.whatTheyWant")}
                placeholder="What 'useful' means to this audience…"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interests</Label>
              <TagField control={control} name="audienceProfile.interests" placeholder="Add an interest…" />
            </div>
            <div className="space-y-1.5">
              <Label>Pain points</Label>
              <TagField control={control} name="audienceProfile.painPoints" placeholder="Add a pain point…" />
            </div>
          </Section>

          <Section
            id="rubrics"
            title="Rubrics"
            description="What 'good' looks like for this persona. Read-only in V1."
          >
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <RubricRow label="Research" value={(initial ?? EMPTY_PERSONA).defaultRubricRefs.research} />
              <RubricRow
                label="Long-Form Master"
                value={(initial ?? EMPTY_PERSONA).defaultRubricRefs.longFormMaster}
              />
              <RubricRow
                label="LinkedIn post"
                value={(initial ?? EMPTY_PERSONA).defaultRubricRefs.linkedinPost}
              />
              <RubricRow label="Article" value={(initial ?? EMPTY_PERSONA).defaultRubricRefs.article} />
            </dl>
          </Section>
        </div>
      </div>

      <SaveBar
        dirty={isDirty}
        saving={isSubmitting}
        error={saveError}
        onSave={() => handleSubmit(onValid)()}
        onCancel={() => router.push("/personas")}
        saveLabel={personaId ? "Save changes" : "Create persona"}
      />
    </form>
  )
}

function RubricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  )
}
