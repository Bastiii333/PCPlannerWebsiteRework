import { useCallback } from 'react'
import PartSelector from './PartSelector'
import type { PartOption, PartRecord } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'

function mapPsu(psu: PartRecord, index: number): PartOption {
  const name = psu.metadata?.name ?? String(psu.name ?? psu.opendb_id ?? `PSU ${index + 1}`)
  const manufacturer = psu.metadata?.manufacturer
  const details = [
    manufacturer,
    typeof psu.wattage === 'number' ? `${psu.wattage}W` : undefined,
    typeof psu.efficiency_rating === 'string' ? psu.efficiency_rating : undefined,
    typeof psu.form_factor === 'string' ? psu.form_factor : undefined,
    typeof psu.modular === 'string' ? psu.modular : undefined,
  ].filter(Boolean).join(' • ')

  return {
    value: psu.opendb_id ?? `${name}-${index}`,
    label: name,
    details: details || 'PSU specifications unavailable',
    price: 'Price unavailable',
    badge: manufacturer,
  }
}

function PsuSelector() {
  const mapPart = useCallback((part: PartRecord, index: number) => mapPsu(part, index), [])
  const psu = usePaginatedParts<PartRecord>('http://localhost:3000/api/psus', mapPart)

  return (
    <PartSelector
      windowId="psu-selector-window" selectionId="psu-selection" inputId="psu-select"
      title="Select your PSU" icon="🔌" defaultPosition={{ x: 560, y: 400 }}
      options={psu.options} value={psu.selected} onChange={psu.setSelected}
      isLoading={psu.isLoading} isLoadingMore={psu.isLoadingMore}
      hasMore={psu.hasMore} onLoadMore={psu.loadMore} error={psu.error}
    />
  )
}

export default PsuSelector
