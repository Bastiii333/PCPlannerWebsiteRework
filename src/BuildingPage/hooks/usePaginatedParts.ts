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
  search: string
  setSearch: (value: string) => void
}

const DEFAULT_PAGE_SIZE = 50
const SEARCH_DEBOUNCE_MS = 450
const MIN_SERVER_SEARCH_LENGTH = 2

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
  const [search, setSearch] = useState('')
  const loadingRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    if (loadingRef.current) return

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const controller = new AbortController()
    controllerRef.current?.abort()
    controllerRef.current = controller
    loadingRef.current = true
    const trimmedSearch = search.trim()
    const serverSearch =
      trimmedSearch.length >= MIN_SERVER_SEARCH_LENGTH ? trimmedSearch : ''
    const requestLimit = serverSearch ? 3 : pageSize
    setError(null)
    if (append) setIsLoadingMore(true)
    else setIsLoading(true)

    try {
      const response = await fetch(
        `${endpoint}?offset=${offset}&limit=${requestLimit}&search=${encodeURIComponent(serverSearch)}`,
        { signal: controller.signal }
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch parts (${response.status})`)
      }

      const result: PaginatedResponse<T> = await response.json()
      if (requestId !== requestIdRef.current) return
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
      if (requestId !== requestIdRef.current) return
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load parts'
      )
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false
        controllerRef.current = null
        if (append) setIsLoadingMore(false)
        else setIsLoading(false)
      }
    }
  }, [endpoint, mapPart, pageSize, search])

  useEffect(() => {
    const debounce = window.setTimeout(() => {
      setOptions([])
      setHasMore(true)
      setNextOffset(0)
      void loadPage(0, false)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(debounce)
      controllerRef.current?.abort()
      requestIdRef.current += 1
      loadingRef.current = false
      controllerRef.current = null
      setIsLoading(false)
      setIsLoadingMore(false)
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
    search,
    setSearch,
  }
}
