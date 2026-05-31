"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createProjectSchema } from "@/lib/validations/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

type FieldErrors = Partial<Record<"name" | "topic" | "targetAudience" | "durationMinutes", string[]>>

export default function NewProjectPage() {
  const router = useRouter()
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const raw = {
      name: formData.get("name") as string,
      topic: formData.get("topic") as string,
      targetAudience: formData.get("targetAudience") as string,
      durationMinutes: Number(formData.get("durationMinutes")),
    }

    const result = createProjectSchema.safeParse(raw)
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors as FieldErrors)
      return
    }

    setSubmitting(true)
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.data),
    })

    if (!res.ok) {
      const body = await res.json()
      setErrors(body.errors ?? {})
      setSubmitting(false)
      return
    }

    const { id } = await res.json()
    router.push(`/project/${id}/ideation`)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>New Project</CardTitle>
            <CardDescription>
              Create a new eLearning video project
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Workplace Safety Training"
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name[0]}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="topic">Topic</Label>
                <Textarea
                  id="topic"
                  name="topic"
                  rows={3}
                  placeholder="Describe the subject matter and key learning objectives..."
                  aria-invalid={!!errors.topic}
                />
                {errors.topic && (
                  <p className="text-xs text-destructive">{errors.topic[0]}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="targetAudience">Target Audience</Label>
                <Input
                  id="targetAudience"
                  name="targetAudience"
                  placeholder="e.g. New warehouse employees"
                  aria-invalid={!!errors.targetAudience}
                />
                {errors.targetAudience && (
                  <p className="text-xs text-destructive">{errors.targetAudience[0]}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input
                  id="durationMinutes"
                  name="durationMinutes"
                  type="number"
                  min={1}
                  max={6000}
                  defaultValue={10}
                  aria-invalid={!!errors.durationMinutes}
                />
                {errors.durationMinutes && (
                  <p className="text-xs text-destructive">{errors.durationMinutes[0]}</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Link href="/dashboard">
                <Button variant="ghost" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Project"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}
