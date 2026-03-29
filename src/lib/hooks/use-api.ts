'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ApiState<T> {
  data: T | null
  error: string | null
  loading: boolean
}

interface UseApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  /** Skip the initial fetch on mount (useful for POST/mutations) */
  skip?: boolean
}

interface UseApiResult<T> extends ApiState<T> {
  refetch: () => Promise<void>
}

export function useApi<T>(url: string, options?: UseApiOptions): UseApiResult<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: !options?.skip,
  })

  const optionsRef = useRef(options)
  optionsRef.current = options

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const opts = optionsRef.current
      const res = await fetch(url, {
        method: opts?.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...opts?.headers,
        },
        ...(opts?.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      })

      const json = await res.json()

      if (!res.ok) {
        const message = (json as { error?: string }).error ?? `Request failed (${res.status})`
        setState({ data: null, error: message, loading: false })
        return
      }

      setState({ data: json as T, error: null, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      setState({ data: null, error: message, loading: false })
    }
  }, [url])

  useEffect(() => {
    if (optionsRef.current?.skip) return
    fetchData()
  }, [fetchData])

  return { ...state, refetch: fetchData }
}
