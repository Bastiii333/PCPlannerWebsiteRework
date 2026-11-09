import { useCallback, useMemo, useState } from 'react'
import Select from 'react-select'
import type { PartOption, PartRecord, StorageType } from '../types/parts'
import { usePaginatedParts } from '../hooks/usePaginatedParts'
import { selectStyles } from './selectorStyles'
import nvmeIcon from '../../assets/nvme icon.jpg'
import ssdIcon from '../../assets/ssd icon.jpg'
import hddIcon from '../../assets/hdd icon.jpg'

type StorageSelection = {
  type: StorageType
  part: PartOption | null
}

type StorageSelectorProps = {
  m2Slots: number
  sataPorts: number
  selected: StorageSelection[]
  onSelectedChange: (selections: StorageSelection[]) => void
}

function mapStorage(storage: PartRecord, index: number): PartOption {
  const name = storage.metadata?.name
    ?? String(storage.name ?? storage.opendb_id ?? `Storage ${index + 1}`)
  const manufacturer = storage.metadata?.manufacturer
  const isNvme = storage.nvme === true
  const storageType: StorageType = isNvme
    ? 'nvme'
    : String(storage.storage_type ?? '').toLowerCase() === 'hdd'
      ? 'hdd'
      : 'ssd'
  const details = [
    manufacturer,
    typeof storage.capacity === 'number' ? `${storage.capacity}GB` : undefined,
    typeof storage.form_factor === 'string' ? storage.form_factor : undefined,
    typeof storage.interface === 'string' ? storage.interface : undefined,
  ].filter(Boolean).join(' • ')

  return {
    value: storage.opendb_id ?? `${name}-${index}`,
    label: name,
    details: details || 'Storage specifications unavailable',
    price: 'Price unavailable',
    badge: manufacturer,
    storageType,
    capacity: typeof storage.capacity === 'number' ? storage.capacity : undefined,
    interface: typeof storage.interface === 'string' ? storage.interface : undefined,
    formFactor: typeof storage.form_factor === 'string' ? storage.form_factor : undefined,
  }
}

function StorageSelect({
  inputId,
  label,
  icon,
  options,
  value,
  onChange,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  error,
  storageType,
  onStorageTypeChange,
}: {
  inputId: string
  label: string
  icon: string
  options: PartOption[]
  value: PartOption | null
  onChange: (option: PartOption | null) => void
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  error: string | null
  storageType: StorageType
  onStorageTypeChange?: (type: StorageType) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
        <img src={icon} alt="" className="h-7 w-7 rounded-lg object-cover" />
        <label htmlFor={inputId} className="text-sm font-semibold text-slate-700">{label}</label>
        </div>
        {onStorageTypeChange && (
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {(['ssd', 'hdd'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase ${
                  storageType === type ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'
                }`}
                aria-pressed={storageType === type}
                onClick={() => onStorageTypeChange(type)}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>
      <Select<PartOption, false>
        inputId={inputId}
        aria-label={label}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={isLoading ? 'Loading storage...' : 'Search and select a drive...'}
        isLoading={isLoading || isLoadingMore}
        isDisabled={(isLoading && options.length === 0) || (Boolean(error) && options.length === 0)}
        isClearable
        menuPortalTarget={document.body}
        menuPosition="fixed"
        onMenuOpen={onLoadMore}
        onMenuScrollToBottom={onLoadMore}
        noOptionsMessage={() =>
          error && options.length === 0
            ? 'Unable to load storage'
            : hasMore ? 'Scroll to load more storage' : 'No matching drives found'
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
  )
}

function StorageSelector({
  m2Slots,
  sataPorts,
  selected,
  onSelectedChange,
}: StorageSelectorProps) {
  const [storageOptions, setStorageOptions] = useState<StorageSelection[]>(selected)
  const mapPart = useCallback((part: PartRecord, index: number) => mapStorage(part, index), [])
  const storage = usePaginatedParts<PartRecord>('http://localhost:3000/api/storage', mapPart)
  const nvmeOptions = useMemo(
    () => storage.options.filter((option) => option.storageType === 'nvme'),
    [storage.options]
  )
  const sataOptions = useMemo(
    () => storage.options.filter((option) => option.storageType !== 'nvme'),
    [storage.options]
  )

  const updateSelection = (index: number, type: StorageType, part: PartOption | null) => {
    const next = Array.from({ length: m2Slots + sataPorts }, (_, selectionIndex) =>
      storageOptions[selectionIndex] ?? { type: selectionIndex < m2Slots ? 'nvme' : 'ssd', part: null }
    )
    next[index] = { type, part }
    setStorageOptions(next)
    onSelectedChange(next)
  }

  if (m2Slots <= 0 && sataPorts <= 0) {
    return null
  }

  return (
    <section
      id="storage-selection"
      data-component="StorageSelection"
      data-element="storage-selector"
      className="selector-card p-4"
    >
      <div className="mb-4">
        <p className="selector-kicker">Choose your drives</p>
        <h2 className="selector-title">Storage</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          NVMe drives use M.2 slots. SSDs and hard drives share the available SATA ports.
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: m2Slots }, (_, index) => (
          <StorageSelect
            key={`nvme-${index}`}
            inputId={`nvme-slot-${index + 1}`}
            label={`NVMe slot ${index + 1}`}
            icon={nvmeIcon}
            options={nvmeOptions}
            value={storageOptions[index]?.part ?? null}
            onChange={(part) => updateSelection(index, 'nvme', part)}
            isLoading={storage.isLoading}
            isLoadingMore={storage.isLoadingMore}
            hasMore={storage.hasMore}
            onLoadMore={storage.loadMore}
            error={storage.error}
            storageType="nvme"
          />
        ))}
        {Array.from({ length: sataPorts }, (_, index) => {
          const selectionIndex = m2Slots + index
          const sataSelection = storageOptions[selectionIndex] ?? { type: 'ssd' as const, part: null }
          return (
            <StorageSelect
              key={`sata-${index}`}
              inputId={`sata-slot-${index + 1}`}
              label={`SATA port ${index + 1} (${sataSelection.type === 'hdd' ? 'HDD' : 'SSD'})`}
              icon={sataSelection.type === 'hdd' ? hddIcon : ssdIcon}
              options={sataOptions}
              value={sataSelection.part}
              onChange={(part) => updateSelection(selectionIndex, sataSelection.type, part)}
              storageType={sataSelection.type}
              onStorageTypeChange={(type) => updateSelection(selectionIndex, type, null)}
              isLoading={storage.isLoading}
              isLoadingMore={storage.isLoadingMore}
              hasMore={storage.hasMore}
              onLoadMore={storage.loadMore}
              error={storage.error}
            />
          )
        })}
      </div>
      {storage.error && <p role="alert" className="mt-3 text-sm text-red-600">{storage.error}. Make sure your backend is running.</p>}
    </section>
  )
}

export type { StorageSelection }
export default StorageSelector
