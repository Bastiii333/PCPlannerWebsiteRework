import { useCallback, useMemo, useState } from 'react'
import Select from 'react-select'
import { Rnd } from 'react-rnd'
import { selectStyles } from './selectorStyles'
import type { PartOption, PartRecord } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'
import ramIcon from '../../assets/ram icon.jpg'

type RamSelectorProps = {
  slotCount: number
  ramType?: string
}

function mapRam(ram: PartRecord, index: number): PartOption {
  const name = ram.metadata?.name ?? String(ram.name ?? ram.opendb_id ?? `RAM ${index + 1}`)
  const manufacturer = ram.metadata?.manufacturer
  const details = [
    manufacturer,
    typeof ram.ram_type === 'string' ? ram.ram_type : undefined,
    typeof ram.capacity === 'number' ? `${ram.capacity}GB` : undefined,
    typeof ram.speed === 'number' ? `${ram.speed} MT/s` : undefined,
  ].filter(Boolean).join(' • ')

  return {
    value: ram.opendb_id ?? `${name}-${index}`,
    label: name,
    details: details || 'RAM specifications unavailable',
    price: 'Price unavailable',
    badge: manufacturer,
    ramType: typeof ram.ram_type === 'string' ? ram.ram_type : undefined,
  }
}

function RamSelector({ slotCount, ramType }: RamSelectorProps) {
  const [selectedRam, setSelectedRam] = useState<Array<PartOption | null>>([])
  const mapPart = useCallback((part: PartRecord, index: number) => mapRam(part, index), [])
  const ram = usePaginatedParts<PartRecord>('http://localhost:3000/api/rams', mapPart)
  const options = useMemo(
    () => ramType
      ? ram.options.filter((option) => option.ramType === ramType)
      : ram.options,
    [ram.options, ramType]
  )

  const updateSlot = (slotIndex: number, option: PartOption | null) => {
    setSelectedRam((current) => {
      const next = Array.from({ length: slotCount }, (_, index) => current[index] ?? null)
      next[slotIndex] = option
      return next
    })
  }

  if (slotCount <= 0) {
    return null
  }

  return (
    <Rnd
      id="ram-selector-window"
      data-component="RamSelectorWindow"
      bounds="parent"
      default={{ x: 2300, y: 1660, width: 'min(520px, calc(100vw - 32px))', height: 360 }}
      enableResizing={false}
      dragHandleClassName="part-selector-drag-handle"
      data-element="selector-window"
      className="part-selector-window"
    >
      <div
        id="ram-selection"
        data-component="RamSelectionSection"
        data-element="selector-card"
        className="selector-card"
        onPointerDown={(event) => event.stopPropagation()}
        onPointerMove={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <div id="ram-selection-title-bar" data-element="window-title-bar" className="part-selector-drag-handle selector-title-bar">
          <div data-element="section-icon" className="selector-icon">
            <img src={ramIcon} alt="" className="selector-icon-image" />
          </div>
          <div data-element="section-heading">
            <p data-element="section-label" className="selector-kicker">Choose your memory</p>
            <h2 data-element="section-title" className="selector-title">
              Select RAM ({ramType ?? 'compatible type'})
            </h2>
          </div>
        </div>
        <div id="ram-selection-content" data-element="selector-content" className="selector-content">
          {Array.from({ length: slotCount }, (_, slotIndex) => (
            <div key={`ram-slot-${slotIndex}`} className="mb-3">
              <label htmlFor={`ram-slot-${slotIndex}`} className="selector-label">
                RAM slot {slotIndex + 1}
              </label>
              <Select<PartOption, false>
                inputId={`ram-slot-${slotIndex}`}
                aria-label={`RAM slot ${slotIndex + 1}`}
                options={options}
                value={selectedRam[slotIndex] ?? null}
                onChange={(option) => updateSlot(slotIndex, option)}
                placeholder={ram.isLoading ? 'Loading RAM...' : 'Search and select RAM...'}
                isLoading={ram.isLoading || ram.isLoadingMore}
                isDisabled={Boolean(ram.error) && options.length === 0}
                isClearable
                menuPortalTarget={document.body}
                menuPosition="fixed"
                onMenuOpen={ram.loadMore}
                onMenuScrollToBottom={ram.loadMore}
                noOptionsMessage={() =>
                  ram.error && options.length === 0
                    ? 'Unable to load RAM'
                    : ram.hasMore
                      ? 'Scroll to load more RAM'
                      : 'No compatible RAM found'
                }
                formatOptionLabel={(option) => (
                  <div className="selector-option">
                    <div>
                      <p className="selector-option-label">{option.label}</p>
                      <p className="selector-option-details">{option.details}</p>
                    </div>
                    <span className="selector-option-price">{option.price}</span>
                  </div>
                )}
                styles={selectStyles}
              />
            </div>
          ))}
          {ram.error && <p role="alert" className="mt-3 text-sm text-red-600">{ram.error}. Make sure your backend is running.</p>}
        </div>
      </div>
    </Rnd>
  )
}

export default RamSelector
