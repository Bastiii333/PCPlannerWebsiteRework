import { useCallback } from 'react'
import PartSelector from './PartSelector'
import type { PartOption, PartRecord } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'
import motherboardIcon from '../../assets/mobo icon.jpg'

type MotherboardSelectorProps = {
  selected: PartOption | null
  onSelectedChange: (option: PartOption | null) => void
  compatibleSocket?: string
}

function mapMotherboard(board: PartRecord, index: number): PartOption {
  const name = board.metadata?.name ?? String(board.name ?? board.opendb_id ?? `Motherboard ${index + 1}`)
  const manufacturer = board.metadata?.manufacturer
  const memory = typeof board.memory === 'object' && board.memory !== null && 'ram_type' in board.memory
    ? String(board.memory.ram_type)
    : undefined
  const ramSlots = typeof board.memory === 'object' && board.memory !== null && 'slots' in board.memory
    && typeof board.memory.slots === 'number'
    ? board.memory.slots
    : undefined
  const m2Slots = Array.isArray(board.m2_slots) ? board.m2_slots.length : undefined
  const storageDevices = typeof board.storage_devices === 'object'
    && board.storage_devices !== null
    ? board.storage_devices as Record<string, unknown>
    : undefined
  const sataPorts = storageDevices
    ? ['sata_6_gb_s', 'sata_3_gb_s'].reduce((total, key) => {
      const count = storageDevices[key]
      return total + (typeof count === 'number' ? count : 0)
    }, 0)
    : undefined
  const details = [
    manufacturer,
    typeof board.socket === 'string' ? board.socket : undefined,
    typeof board.form_factor === 'string' ? board.form_factor : undefined,
    typeof board.chipset === 'string' ? board.chipset : undefined,
    memory,
    m2Slots !== undefined ? `${m2Slots} M.2 slots` : undefined,
    sataPorts !== undefined ? `${sataPorts} SATA ports` : undefined,
  ].filter(Boolean).join(' • ')

  return {
    value: board.opendb_id ?? `${name}-${index}`,
    label: name,
    details: details || 'Motherboard specifications unavailable',
    price: 'Price unavailable',
    badge: manufacturer,
    socket: typeof board.socket === 'string' ? board.socket : undefined,
    ramType: memory,
    ramSlots,
    m2Slots,
    sataPorts,
    maxMemoryCapacity: typeof board.memory === 'object' && board.memory !== null
      && 'max' in board.memory && typeof board.memory.max === 'number'
      ? board.memory.max
      : undefined,
  }
}

function MotherboardSelector({
  selected,
  onSelectedChange,
  compatibleSocket,
}: MotherboardSelectorProps) {
  const mapPart = useCallback((part: PartRecord, index: number) => mapMotherboard(part, index), [])
  const motherboard = usePaginatedParts<PartRecord>('http://localhost:3000/api/motherboards', mapPart)
  const options = compatibleSocket
    ? motherboard.options.filter((option) => option.socket === compatibleSocket)
    : motherboard.options

  return (
    <PartSelector
      windowId="motherboard-selector-window" selectionId="motherboard-selection" inputId="motherboard-select"
      title="Select your motherboard" icon={motherboardIcon}
      options={options}
      value={selected}
      onChange={(option) => {
        motherboard.setSelected(option)
        onSelectedChange(option)
      }}
      isLoading={motherboard.isLoading} isLoadingMore={motherboard.isLoadingMore}
      hasMore={motherboard.hasMore} onLoadMore={motherboard.loadMore} error={motherboard.error}
      search={motherboard.search} onSearchChange={motherboard.setSearch}
    />
  )
}

export default MotherboardSelector
