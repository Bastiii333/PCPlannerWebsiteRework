import { useCallback } from 'react'
import PartSelector from './PartSelector'
import type { PartOption, PartRecord } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'
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
  }
}

function GpuSelector() {
  const mapPart = useCallback((part: PartRecord, index: number) => mapGpu(part, index), [])
  const gpu = usePaginatedParts<PartRecord>('http://localhost:3000/api/gpus', mapPart)

  return (
    <PartSelector
      windowId="gpu-selector-window" selectionId="gpu-selection" inputId="gpu-select"
      title="Select your GPU" icon={gpuIcon} defaultPosition={{ x: 2300, y: 1260 }}
      options={gpu.options} value={gpu.selected} onChange={gpu.setSelected}
      isLoading={gpu.isLoading} isLoadingMore={gpu.isLoadingMore}
      hasMore={gpu.hasMore} onLoadMore={gpu.loadMore} error={gpu.error}
    />
  )
}

export default GpuSelector
