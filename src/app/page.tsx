import Link from "next/link"

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
      <h1 className="font-heading text-3xl font-semibold">CreatorOS</h1>
      <p className="mt-2 text-muted-foreground">
        Agentic AI content production OS. V1 in progress.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/personas"
          className="rounded-lg border border-border p-5 transition-colors hover:bg-muted/40"
        >
          <h2 className="font-medium">Personas →</h2>
          <p className="text-sm text-muted-foreground">Authoring identities for your content.</p>
        </Link>
        <Link
          href="/workspaces"
          className="rounded-lg border border-border p-5 transition-colors hover:bg-muted/40"
        >
          <h2 className="font-medium">Workspaces →</h2>
          <p className="text-sm text-muted-foreground">Projects, ideas, and content.</p>
        </Link>
      </div>
    </main>
  )
}
