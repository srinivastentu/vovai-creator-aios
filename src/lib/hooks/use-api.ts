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

// ─── Mutation Hook (POST / PATCH / DELETE) ─────────────────────────────────

interface UseApiMutationResult<TBody, TResponse> {
  mutate: (body: TBody) => Promise<TResponse>
  loading: boolean
  error: string | null
}

export function useApiMutation<TBody, TResponse>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE' = 'POST'
): UseApiMutationResult<TBody, TResponse> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async (body: TBody): Promise<TResponse> => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const json = await res.json()

        if (!res.ok) {
          const message = (json as { error?: string }).error ?? `Request failed (${res.status})`
          setError(message)
          throw new Error(message)
        }

        return json as TResponse
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Network error'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [url, method]
  )

  return { mutate, loading, error }
}
