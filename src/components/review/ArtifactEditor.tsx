"use client"

import { useState } from "react"
import type { ArtifactType } from "@/generated/prisma/client"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArtifactBody, bodySizeLabel } from "./ArtifactBody"

// Inline editor for an artifact body: a Write tab (raw text / markdown — byte-clean,
// no WYSIWYG so markdown round-trips exactly) and a Preview tab (rendered output).
// Read-only when `editable` is false (the artifact is no longer awaiting review).
export function ArtifactEditor({
  type,
  value,
  onChange,
  editable,
}: {
  type: ArtifactType
  value: string
  onChange: (next: string) => void
  editable: boolean
}) {
  const [tab, setTab] = useState<"write" | "preview">("write")

  if (!editable) {
    return (
      <div>
        <ArtifactBody type={type} body={value} />
        <p className="mt-3 text-xs text-muted-foreground">{bodySizeLabel(type, value)}</p>
      </div>
    )
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "write" | "preview")}>
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <span className="text-xs text-muted-foreground">{bodySizeLabel(type, value)}</span>
      </div>

      <TabsContent value="write" className="mt-3">
        <Textarea
          aria-label="Artifact body"
          rows={type === "linkedin_post" ? 16 : 24}
          className="font-mono text-xs leading-6"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {type === "linkedin_post"
            ? "Plain text. Blank lines separate paragraphs."
            : "Markdown. Keep the H1 title, an intro before the first ##, ≥2 ## sections, and a conclusion."}
        </p>
      </TabsContent>

      <TabsContent value="preview" className="mt-3">
        <div className="rounded-md border border-border p-4">
          <ArtifactBody type={type} body={value} />
        </div>
      </TabsContent>
    </Tabs>
  )
}
