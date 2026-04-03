'use client'

import { AlertTriangle, RefreshCw, WifiOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  variant?: 'inline' | 'banner' | 'card'
}

function friendlyMessage(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return 'Connection lost. Check your internet and retry.'
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('took too long')) {
    return 'Request took too long. Try again?'
  }
  if (lower.includes('500') || lower.includes('internal server')) {
    return 'Something went wrong on our end. Please try again.'
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'The requested resource was not found.'
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) {
    return 'You don\'t have permission to perform this action.'
  }
  // Don't show raw error objects
  if (raw.startsWith('{') || raw.startsWith('[')) {
    return 'Something went wrong. Please try again.'
  }
  return raw
}

export function ErrorBanner({ message, onRetry, onDismiss, variant = 'banner' }: ErrorBannerProps) {
  const friendly = friendlyMessage(message)
  const isNetwork = friendly.includes('Connection lost')

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle size={14} className="shrink-0" />
        <span className="flex-1 text-xs">{friendly}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 text-xs font-medium underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          {isNetwork ? (
            <WifiOff size={24} className="text-destructive" />
          ) : (
            <AlertTriangle size={24} className="text-destructive" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-destructive">{friendly}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-1 gap-1.5">
            <RefreshCw size={14} />
            Try again
          </Button>
        )}
      </div>
    )
  }

  // banner (default)
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
      <AlertTriangle size={14} className="shrink-0 text-destructive" />
      <span className="flex-1 text-xs text-destructive">{friendly}</span>
      {onRetry && (
        <Button variant="ghost" size="xs" onClick={onRetry} className="shrink-0 gap-1 text-destructive hover:text-destructive">
          <RefreshCw size={12} />
          Retry
        </Button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-destructive/60 hover:text-destructive"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
