import { useCallback } from 'react'
import PartSelector from './PartSelector'
import type { PartOption, PartRecord } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'

type CpuSelectorProps = {
  selected: PartOption | null
  onSelectedChange: (option: PartOption | null) => void
  compatibleSocket?: string
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

  return {
    value: cpu.opendb_id ?? `${name}-${index}`,
    label: name,
    details: details || 'CPU specifications unavailable',
    price: 'Price unavailable',
    badge: manufacturer,
    socket: typeof cpu.socket === 'string' ? cpu.socket : undefined,
  }
}

function CpuSelector({
  selected,
  onSelectedChange,
  compatibleSocket,
}: CpuSelectorProps) {
  const mapPart = useCallback((part: PartRecord, index: number) => mapCpu(part, index), [])
  const cpu = usePaginatedParts<PartRecord>('http://localhost:3000/api/cpus', mapPart)
  const options = compatibleSocket
    ? cpu.options.filter((option) => option.socket === compatibleSocket)
    : cpu.options

  return (
    <PartSelector
      windowId="cpu-selector-window" selectionId="cpu-selection" inputId="cpu-select"
      title="Select your CPU" icon="⚡" defaultPosition={{ x: 16, y: 16 }}
      options={options}
      value={selected}
      onChange={(option) => {
        cpu.setSelected(option)
        onSelectedChange(option)
      }}
      isLoading={cpu.isLoading} isLoadingMore={cpu.isLoadingMore}
      hasMore={cpu.hasMore} onLoadMore={cpu.loadMore} error={cpu.error}
    />
  )
}

export default CpuSelector
