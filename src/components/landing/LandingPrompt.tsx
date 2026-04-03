"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"

export function LandingPrompt() {
  const router = useRouter()
  const [value, setValue] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSubmit = value.trim().length >= 10 && !submitting

  const handleSubmit = useCallback(async () => {
    const intent = value.trim()
    if (intent.length < 10 || submitting) return

    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch("/api/projects/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      })

      if (!res.ok) {
        const body = await res.json()
        setError(body.error ?? "Something went wrong")
        setSubmitting(false)
        return
      }

      const { projectId } = await res.json()
      sessionStorage.setItem("brief", intent)
      router.push(`/project/${projectId}`)
    } catch {
      setError("Network error. Please try again.")
      setSubmitting(false)
    }
  }, [value, submitting, router])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // Auto-resize textarea
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm focus-within:border-white/20 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Describe your learning intent here to ideate, design, and build a great learning experience..."
          rows={3}
          disabled={submitting}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-12 text-white placeholder:text-gray-500 focus:outline-none text-[15px] leading-relaxed"
        />
        <div className="absolute bottom-3 right-3">
          <Button
            size="icon"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:opacity-50 size-8"
          >
            {submitting ? (
              <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <ArrowUp className="size-4 text-white" />
            )}
          </Button>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-gray-500">
        Enter to send &middot; AI agents guide your entire project
      </p>

      {error && (
        <p className="mt-2 text-center text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
