import { useCallback } from 'react'
import PartSelector from './PartSelector'
import type { PartOption, PartRecord } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'
import { estimateGpuPerformanceScore } from '../validation/performanceScore'
import gpuIcon from '../../assets/gpu icon.jpg'

function mapGpu(gpu: PartRecord, index: number): PartOption {
  const name = gpu.metadata?.name ?? String(gpu.name ?? gpu.chipset ?? gpu.opendb_id ?? `GPU ${index + 1}`)
  const manufacturer = gpu.metadata?.manufacturer
  const details = [
    manufacturer,
    typeof gpu.chipset === 'string' ? gpu.chipset : undefined,
    typeof gpu.memory === 'number' ? `${gpu.memory}GB` : undefined,
    typeof gpu.interface === 'string' ? gpu.interface : undefined,
    typeof gpu.tdp === 'number' ? `${gpu.tdp}W TDP` : undefined,
  ].filter(Boolean).join(' • ')

  return {
    value: gpu.opendb_id ?? `${name}-${index}`,
    label: name,
    details: details || 'GPU specifications unavailable',
    price: 'Price unavailable',
    badge: manufacturer,
    powerDraw: typeof gpu.tdp === 'number' ? gpu.tdp : undefined,
    benchmarkScore: typeof gpu.benchmarkScore === 'number'
      ? gpu.benchmarkScore
      : estimateGpuPerformanceScore(gpu),
  }
}

type GpuSelectorProps = {
  selected: PartOption | null
  onSelectedChange: (option: PartOption | null) => void
}

function GpuSelector({ selected, onSelectedChange }: GpuSelectorProps) {
  const mapPart = useCallback((part: PartRecord, index: number) => mapGpu(part, index), [])
  const gpu = usePaginatedParts<PartRecord>('http://localhost:3000/api/gpus', mapPart)

  return (
    <PartSelector
      windowId="gpu-selector-window" selectionId="gpu-selection" inputId="gpu-select"
      title="Select your GPU" icon={gpuIcon}
      options={gpu.options}
      value={selected}
      onChange={(option) => {
        gpu.setSelected(option)
        onSelectedChange(option)
      }}
      isLoading={gpu.isLoading} isLoadingMore={gpu.isLoadingMore}
      hasMore={gpu.hasMore} onLoadMore={gpu.loadMore} error={gpu.error}
      search={gpu.search} onSearchChange={gpu.setSearch}
    />
  )
}

export default GpuSelector
