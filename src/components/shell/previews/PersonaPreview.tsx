import type { AudienceProfile, CreatorProfile, VoiceTone } from "@/lib/domain/persona-schema"
import { cn } from "@/lib/utils"

// Right-pane sample of a persona's voice + audience + creator profile. Pure
// render of fields the persona already holds — no backend read.

function Chips({ items, tone = "muted" }: { items: string[]; tone?: "muted" | "danger" }) {
  if (items.length === 0) return <span className="text-sm text-muted-foreground/70">—</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span
          key={`${it}-${i}`}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs",
            tone === "danger"
              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {it}
        </span>
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-1.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  )
}

export function PersonaPreview({
  persona,
}: {
  persona: {
    name: string
    niches: string[]
    voiceTone: VoiceTone
    audienceProfile: AudienceProfile
    creatorProfile: CreatorProfile
  }
}) {
  const { creatorProfile: creator, voiceTone: voice, audienceProfile: audience } = persona
  return (
    <div className="mx-auto max-w-prose space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-foreground">{persona.name || "Untitled persona"}</h2>
        {creator.name && creator.name !== persona.name ? (
          <p className="text-sm text-muted-foreground">by {creator.name}</p>
        ) : null}
        {creator.bio ? <p className="mt-2 text-sm leading-7 text-foreground/90">{creator.bio}</p> : null}
        {persona.niches.length > 0 && (
          <div className="mt-3">
            <Chips items={persona.niches} />
          </div>
        )}
      </header>

      <section>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Voice</h3>
        <dl>
          <Row label="Formality">{voice.formality || "—"}</Row>
          <Row label="Vocabulary">{voice.vocabulary || "—"}</Row>
          <Row label="Signature">
            <Chips items={voice.signaturePhrases} />
          </Row>
          <Row label="Avoids">
            <Chips items={voice.doNotSay} tone="danger" />
          </Row>
        </dl>
      </section>

      <section>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Audience</h3>
        <dl>
          <Row label="Role">
            {[audience.primaryRole, audience.experienceLevel].filter(Boolean).join(" · ") || "—"}
          </Row>
          <Row label="Interests">
            <Chips items={audience.interests} />
          </Row>
          <Row label="Pain points">
            <Chips items={audience.painPoints} />
          </Row>
          {audience.whatTheyWant ? <Row label="Wants">{audience.whatTheyWant}</Row> : null}
        </dl>
      </section>

      {creator.pointOfView ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Point of view
          </h3>
          <p className="text-sm leading-7 text-foreground/90">{creator.pointOfView}</p>
        </section>
      ) : null}
    </div>
  )
}
