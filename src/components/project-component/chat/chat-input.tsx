'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>
  loading?: boolean
  disabled?: boolean
  error?: string | null
  placeholder?: string
}

export function ChatInput({
  onSend,
  loading = false,
  disabled = false,
  error = null,
  placeholder = 'Type your message... (Ctrl+Enter to send)',
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Track how long we've been loading for a timeout indicator
  const [loadingSeconds, setLoadingSeconds] = useState(0)
  useEffect(() => {
    if (!loading) {
      setLoadingSeconds(0)
      return
    }
    const interval = setInterval(() => {
      setLoadingSeconds(s => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [loading])

  const handleSend = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed || loading || disabled) return
    try {
      await onSend(trimmed)
      setValue('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      // Keep value in textarea — error is displayed via the error prop
    }
  }, [value, loading, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  const canSend = value.trim().length > 0 && !loading && !disabled

  return (
    <div className="border-t bg-background p-4">
      {loading && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={12} className="animate-spin" />
          <span>
            Agents are thinking
            <span className="inline-block w-6">{'.'.repeat((loadingSeconds % 3) + 1)}</span>
          </span>
          {loadingSeconds >= 5 && (
            <span className="text-muted-foreground/60">({loadingSeconds}s)</span>
          )}
          {loadingSeconds >= 30 && (
            <span className="text-amber-600 dark:text-amber-400">Taking longer than usual</span>
          )}
        </div>
      )}
      {error && (
        <p className="mb-2 text-xs text-destructive">{error}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          disabled={loading || disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!canSend}
          className="h-9 w-9 shrink-0 p-0"
          aria-label="Send message"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  )
}
