import { useCallback, useEffect, useRef, useState } from 'react'
import type { PartOption } from '../types/parts'

type PaginatedResponse<T> = {
  data: T[]
  hasMore: boolean
  limit: number
}

type UsePaginatedPartsResult = {
  options: PartOption[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  loadMore: () => void
  error: string | null
  selected: PartOption | null
  setSelected: (option: PartOption | null) => void
}

const DEFAULT_PAGE_SIZE = 50

export function usePaginatedParts<T>(
  endpoint: string,
  mapPart: (part: T, index: number) => PartOption,
  pageSize = DEFAULT_PAGE_SIZE
): UsePaginatedPartsResult {
  const [options, setOptions] = useState<PartOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [nextOffset, setNextOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<PartOption | null>(null)
  const loadingRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (loadingRef.current) return

    loadingRef.current = true
    setError(null)
    if (append) setIsLoadingMore(true)
    else setIsLoading(true)

    try {
      const response = await fetch(
        `${endpoint}?offset=${offset}&limit=${pageSize}`,
        { signal: controllerRef.current?.signal }
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch parts (${response.status})`)
      }

      const result: PaginatedResponse<T> = await response.json()
      const pageOptions = result.data.map((part, index) =>
        mapPart(part, offset + index)
      )

      setOptions((currentOptions) =>
        append ? [...currentOptions, ...pageOptions] : pageOptions
      )
      setHasMore(result.hasMore)
      setNextOffset(offset + result.limit)
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === 'AbortError') return
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load parts'
      )
    } finally {
      loadingRef.current = false
      if (append) setIsLoadingMore(false)
      else setIsLoading(false)
    }
  }, [endpoint, mapPart, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller
    void Promise.resolve().then(() => loadPage(0, false))

    return () => {
      controller.abort()
      controllerRef.current = null
    }
  }, [loadPage])

  const loadMore = useCallback(() => {
    if (hasMore && !loadingRef.current) void loadPage(nextOffset, true)
  }, [hasMore, loadPage, nextOffset])

  return {
    options,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    error,
    selected,
    setSelected,
  }
}
