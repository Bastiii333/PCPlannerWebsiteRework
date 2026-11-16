import { useCallback, useEffect, useMemo } from 'react'
import PartSelector from './PartSelector'
import type { PartOption, PartRecord } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'
import { estimateCpuPerformanceScore } from '../validation/performanceScore'
import cpuIcon from '../../assets/cpu icon.jpg'

type CpuSelectorProps = {
  selected: PartOption | null
  onSelectedChange: (option: PartOption | null) => void
  compatibleSocket?: string
  onOptionsChange?: (options: PartOption[]) => void
}

function mapCpu(cpu: PartRecord, index: number): PartOption {
  const name = cpu.metadata?.name ?? String(cpu.name ?? cpu.opendb_id ?? `CPU ${index + 1}`)
  const manufacturer = cpu.metadata?.manufacturer
  const details = [
    manufacturer,
    typeof cpu.socket === 'string' ? `Socket ${cpu.socket}` : undefined,
    typeof cpu.cores === 'object' && cpu.cores !== null && 'total' in cpu.cores
      ? `${String(cpu.cores.total)} cores`
      : undefined,
    cpu.specifications && typeof cpu.specifications === 'object' && cpu.specifications !== null && 'tdp' in cpu.specifications
      ? `${String(cpu.specifications.tdp)}W TDP`
      : undefined,
  ].filter(Boolean).join(' • ')
  const specifications = cpu.specifications && typeof cpu.specifications === 'object'
    ? cpu.specifications as Record<string, unknown>
    : undefined
  const memory = specifications?.memory && typeof specifications.memory === 'object'
    ? specifications.memory as Record<string, unknown>
    : undefined
  const integratedGraphics = specifications?.integratedGraphics
    && typeof specifications.integratedGraphics === 'object'
    ? specifications.integratedGraphics as Record<string, unknown>
    : undefined
  const supportedRamTypes = Array.isArray(memory?.types)
    ? memory.types.filter((type): type is string => typeof type === 'string')
    : undefined
  const usableRamTypes = supportedRamTypes && supportedRamTypes.length > 0
    ? supportedRamTypes
    : undefined
  const benchmarkScore = typeof cpu.benchmarkScore === 'number'
    ? cpu.benchmarkScore
    : estimateCpuPerformanceScore(cpu)

  return {
    value: cpu.opendb_id ?? `${name}-${index}`,
    label: name,
    details: details || 'CPU specifications unavailable',
    price: 'Price unavailable',
    badge: manufacturer,
    socket: typeof cpu.socket === 'string' ? cpu.socket : undefined,
    powerDraw: typeof specifications?.tdp === 'number' ? specifications.tdp : undefined,
    maxMemoryCapacity: typeof memory?.maxSupport === 'number' && memory.maxSupport > 0
      ? memory.maxSupport
      : undefined,
    maxMemorySpeed: typeof memory?.maxSpeed === 'number' && memory.maxSpeed > 0
      ? memory.maxSpeed
      : typeof memory?.max_speed === 'number' && memory.max_speed > 0
        ? memory.max_speed
        : typeof memory?.speed === 'number' && memory.speed > 0 ? memory.speed : undefined,
    supportedRamTypes: usableRamTypes,
    hasIntegratedGraphics: integratedGraphics?.model !== undefined && integratedGraphics.model !== 'None',
    coreCount: typeof cpu.cores === 'object' && cpu.cores !== null && 'total' in cpu.cores
      && typeof cpu.cores.total === 'number' ? cpu.cores.total : undefined,
    benchmarkScore,
  }
}

function CpuSelector({
  selected,
  onSelectedChange,
  compatibleSocket,
  onOptionsChange,
}: CpuSelectorProps) {
  const mapPart = useCallback((part: PartRecord, index: number) => mapCpu(part, index), [])
  const cpu = usePaginatedParts<PartRecord>('http://localhost:3000/api/cpus', mapPart)
  const options = useMemo(
    () => compatibleSocket
      ? cpu.options.filter((option) => option.socket === compatibleSocket)
      : cpu.options,
    [compatibleSocket, cpu.options]
  )

  useEffect(() => {
    onOptionsChange?.(options)
  }, [onOptionsChange, options])

  return (
    <PartSelector
      windowId="cpu-selector-window" selectionId="cpu-selection" inputId="cpu-select"
      title="Select your CPU" icon={cpuIcon}
      options={options}
      value={selected}
      onChange={(option) => {
        cpu.setSelected(option)
        onSelectedChange(option)
      }}
      isLoading={cpu.isLoading} isLoadingMore={cpu.isLoadingMore}
      hasMore={cpu.hasMore} onLoadMore={cpu.loadMore}
      onMenuOpen={cpu.startAutoLoad} onMenuClose={cpu.stopAutoLoad} error={cpu.error}
      search={cpu.search} onSearchChange={cpu.setSearch}
    />
  )
}

export default CpuSelector
