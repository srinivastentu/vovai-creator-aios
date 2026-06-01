import { MarkdownView } from "@/components/review/MarkdownView"

// Right-pane rendering of a Long-Form Master "as it will appear" — title +
// section hierarchy at reading width (~70ch). Reuses MarkdownView (no new dep).
export function MasterPreview({
  master,
}: {
  master: {
    title: string
    sections: { id?: string; heading: string; contentMarkdown: string }[]
  }
}) {
  return (
    <article className="mx-auto max-w-[70ch]">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">{master.title}</h1>
      {master.sections.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">No sections yet.</p>
      ) : (
        master.sections.map((s, i) => (
          <section key={s.id ?? `${s.heading}-${i}`} className="mb-8 scroll-mt-4" id={`section-${i}`}>
            <h2 className="mb-2 text-lg font-semibold text-foreground">{s.heading}</h2>
            <MarkdownView>{s.contentMarkdown}</MarkdownView>
          </section>
        ))
      )}
    </article>
  )
}
