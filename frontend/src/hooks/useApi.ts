import { useCallback, useEffect, useRef, useState } from 'react'

type State<T> = { data: T | null; loading: boolean; error: string | null }
type Fetcher<T, P extends unknown[]> = (...params: P) => Promise<{ data: T }>

export function useApi<T, P extends unknown[] = []>(
  fetcher: Fetcher<T, P>,
  params: P = [] as unknown as P,
) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null })
  const mounted = useRef(true)
  const prevParams = useRef<string>('')

  const currentKey = JSON.stringify(params)

  const execute = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const response = await fetcher(...params)
      if (mounted.current) {
        setState({ data: response.data, loading: false, error: null })
      }
    } catch (err: any) {
      if (mounted.current) {
        const msg = err.response?.data?.error || err.message || '请求失败'
        setState({ data: null, loading: false, error: msg })
      }
    }
  }, [fetcher, currentKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mounted.current = true
    if (currentKey !== prevParams.current) {
      prevParams.current = currentKey
      execute()
    }
    return () => { mounted.current = false }
  }, [currentKey, execute])

  return { ...state, refetch: execute }
}

export function useMutation<T, P extends unknown[]>(
  mutator: (...params: P) => Promise<{ data: T }>,
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    return () => { mounted.current = false }
  }, [])

  const execute = useCallback(
    async (...args: P) => {
      setLoading(true)
      setError(null)
      try {
        const response = await mutator(...args)
        return { data: response.data, success: true as const }
      } catch (err: any) {
        const msg = err.response?.data?.error || err.message || '操作失败'
        if (mounted.current) setError(msg)
        return { error: msg, success: false as const }
      } finally {
        if (mounted.current) setLoading(false)
      }
    },
    [mutator],
  )

  return { execute, loading, error }
}
