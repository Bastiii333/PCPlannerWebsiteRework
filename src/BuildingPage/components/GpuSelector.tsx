import { useCallback, useEffect } from 'react'
import PartSelector from './PartSelector'
import type { PartOption, PartRecord } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'
import { estimateGpuPerformanceScore } from '../validation/performanceScore'
import gpuIcon from '../../assets/gpu icon.jpg'
import { apiUrl } from '../../api'

function mapGpu(gpu: PartRecord, index: number): PartOption {
  const name = gpu.metadata?.name ?? String(gpu.name ?? gpu.chipset ?? gpu.opendb_id ?? `GPU ${index + 1}`)
  const manufacturer = typeof gpu.manufacturer === 'string'
    ? gpu.manufacturer
    : gpu.metadata?.manufacturer
  const chipsetManufacturer = typeof gpu.vendor === 'string'
    ? gpu.vendor
    : typeof gpu.chipset_manufacturer === 'string'
      ? gpu.chipset_manufacturer
      : manufacturer
  const gpuManufacturer = typeof chipsetManufacturer === 'string' && /nvidia/i.test(chipsetManufacturer)
    ? 'nvidia'
    : typeof chipsetManufacturer === 'string' && /amd/i.test(chipsetManufacturer)
      ? 'amd'
      : typeof chipsetManufacturer === 'string' && /intel/i.test(chipsetManufacturer)
        ? 'intel'
        : undefined
  const details = [
    manufacturer,
    typeof gpu.gpuName === 'string'
      ? gpu.gpuName
      : typeof gpu.chipset === 'string' ? gpu.chipset : undefined,
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
    gpuManufacturer,
    gpuPerformanceMetric: gpuManufacturer === 'nvidia' && typeof gpu.shaders === 'number'
      ? gpu.shaders
      : gpuManufacturer === 'amd' && typeof gpu.computeUnits === 'number'
        ? gpu.computeUnits
        : gpuManufacturer === 'intel' && typeof gpu.executionUnits === 'number'
          ? gpu.executionUnits
          : undefined,
  }
}

type GpuSelectorProps = {
  selected: PartOption | null
  onSelectedChange: (option: PartOption | null) => void
  onOptionsChange?: (options: PartOption[]) => void
}

function GpuSelector({ selected, onSelectedChange, onOptionsChange }: GpuSelectorProps) {
  const mapPart = useCallback((part: PartRecord, index: number) => mapGpu(part, index), [])
  const gpu = usePaginatedParts<PartRecord>('/api/gpus', mapPart)

  useEffect(() => {
    onOptionsChange?.(gpu.options)
  }, [gpu.options, onOptionsChange])

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
      hasMore={gpu.hasMore} onLoadMore={gpu.loadMore}
      onMenuOpen={gpu.startAutoLoad} onMenuClose={gpu.stopAutoLoad} error={gpu.error}
      search={gpu.search} onSearchChange={gpu.setSearch}
    />
  )
}

export default GpuSelector
