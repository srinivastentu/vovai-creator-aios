import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getWorkspace } from "@/lib/domain/data/workspaces"
import { getPersona } from "@/lib/domain/data/personas"
import { coachIdeas } from "@/lib/domain/agents/idea-coach"

const Body = z.object({
  umbrella: z.string().min(3),
  niche: z.string().min(1),
})

// POST /api/workspaces/[id]/ideas/coach — proposes 3–5 titles. It does NOT
// create ideas; "Add to log" is a separate createIdea action so the user
// curates which proposals land.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }

  const ws = await getWorkspace(id) // user-scoped; null if not owned
  if (!ws) return NextResponse.json({ error: "not_found" }, { status: 404 })
  const persona = await getPersona(ws.personaId)
  if (!persona) return NextResponse.json({ error: "not_found" }, { status: 404 })

  try {
    const result = await coachIdeas({
      umbrella: parsed.data.umbrella,
      niche: parsed.data.niche,
      persona: {
        name: persona.name,
        audienceProfile: persona.audienceProfile,
        voiceTone: persona.voiceTone,
      },
      workspaceId: id,
    })
    return NextResponse.json(result) // { proposals: [...] }
  } catch {
    return NextResponse.json({ error: "generation_failed" }, { status: 422 })
  }
}
