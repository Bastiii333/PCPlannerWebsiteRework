
import { useEffect, useState } from 'react'
import Select, { type StylesConfig } from 'react-select'
import { Rnd } from 'react-rnd'

type PartOption = {
  value: string
  label: string
  details: string
  price: string
  badge?: string
}

type CpuRecord = {
  opendb_id?: string
  name?: string
  socket?: string
  metadata?: {
    name?: string
    manufacturer?: string
  }
  cores?: {
    total?: number
  }
  specifications?: {
    tdp?: number | string
  }
}

type CpuApiResponse = {
  count: number
  data: CpuRecord[]
}

const selectStyles: StylesConfig<PartOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: '48px',
    borderRadius: '12px',
    borderColor: state.isFocused ? '#8b5cf6' : '#dbe3f0',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(139, 92, 246, 0.14)' : 'none',
    '&:hover': {
      borderColor: '#a78bfa',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '8px 16px',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8',
  }),
  menu: (base) => ({
    ...base,
    overflow: 'hidden',
    borderRadius: '12px',
    boxShadow: '0 16px 36px rgba(30, 41, 59, 0.14)',
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 50,
  }),
  option: (base, state) => ({
    ...base,
    padding: '12px 16px',
    backgroundColor: state.isFocused ? '#f5f3ff' : 'white',
    color: '#1e293b',
    cursor: 'pointer',
  }),
}

function BuildingPage() {
 
const [selectedCpu, setSelectedCpu] = useState<PartOption | null>(null)
const [cpuOptions, setCpuOptions] = useState<PartOption[]>([])
const [isLoadingCpus, setIsLoadingCpus] = useState(true)
const [cpuError, setCpuError] = useState<string | null>(null)

useEffect(() => {
  const controller = new AbortController()

  async function fetchCpus() {
    try {
      setIsLoadingCpus(true)
      setCpuError(null)

      const response = await fetch(
        'http://localhost:3000/api/cpus',
        { signal: controller.signal }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch CPUs (${response.status})`)
      }

      const result: CpuApiResponse = await response.json()

      const options: PartOption[] = result.data.map((cpu, index) => {
        const name =
          cpu.metadata?.name ??
          cpu.name ??
          cpu.opendb_id ??
          `CPU ${index + 1}`

        const manufacturer = cpu.metadata?.manufacturer
        const socket = cpu.socket
        const cores = cpu.cores?.total
        const tdp = cpu.specifications?.tdp

        const details = [
          manufacturer,
          socket ? `Socket ${socket}` : undefined,
          cores != null ? `${cores} cores` : undefined,
          tdp != null ? `${tdp}W TDP` : undefined,
        ]
          .filter(Boolean)
          .join(' • ')

        return {
          value: cpu.opendb_id ?? `${name}-${index}`,
          label: name,
          details: details || 'CPU specifications unavailable',
          price: 'Price unavailable',
          badge: manufacturer,
        }
      })

      setCpuOptions(options)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      setCpuError(
        error instanceof Error
          ? error.message
          : 'Unable to load CPUs'
      )
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingCpus(false)
      }
    }
  }

  void fetchCpus()

  return () => controller.abort()
}, [])

  return (
    <main
      id="building-page"
      data-component="BuildingPage"
      data-element="page-root"
      className="relative min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 lg:px-12"
    >
      <div id="building-container" data-element="page-container" className="mx-auto ">
        <header
          id="building-header"
          data-component="PageHeader"
          data-element="page-header"
          className="mb-10 flex items-center justify-between"
        >
          <div id="page-heading" data-element="heading-group">
            <p
              data-element="page-label"
              className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-violet-600"
            >
              PC Planner
            </p>
            <h1 data-element="page-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Build your PC
            </h1>
          </div>

        </header>

        <section
          id="build-content"
          data-component="BuildContent"
          data-element="build-content"
          className="relative min-h-[calc(100vh-10rem)]"
        >
          <Rnd
            id="cpu-selector-window"
            data-component="PartSelectorWindow"
            bounds="parent"
            default={{
              x: 16,
              y: 16,
              width: 'min(520px, calc(100vw - 32px))',
              height: 360,
            }}
            enableResizing={false}
            dragHandleClassName="part-selector-drag-handle"
            data-element="selector-window"
            className="part-selector-window"
          >
            <div
              id="cpu-selection"
              data-component="CpuSelectionSection"
              data-element="selector-card"
              className="selector-card"
            >
              <div
                id="selector-title-bar"
                data-element="window-title-bar"
                className="part-selector-drag-handle selector-title-bar"
              >
                <div
                  data-element="section-icon"
                  className="selector-icon"
                >
                  ⚡
                </div>
                <div data-element="section-heading">
                  <p data-element="section-label" className="selector-kicker">
                    Choose a part
                  </p>
                  <h2 data-element="section-title" className="selector-title">
                    Select your CPU
                  </h2>
                </div>
              </div>

              <div id="selector-content" data-element="selector-content" className="selector-content">

          
<Select<PartOption, false>
  data-element="cpu-select-control"
  inputId="cpu-select"
  aria-label="Select a CPU"
  options={cpuOptions}
  value={selectedCpu}
  onChange={setSelectedCpu}
  placeholder={
    isLoadingCpus
      ? 'Loading CPUs...'
      : 'Search and select a CPU...'
  }
  isLoading={isLoadingCpus}
  isDisabled={isLoadingCpus || Boolean(cpuError)}
  isClearable
  menuPortalTarget={document.body}
  menuPosition="fixed"
  noOptionsMessage={() =>
    cpuError
      ? 'Unable to load CPUs'
      : 'No matching CPUs found'
  }
  formatOptionLabel={(option) => (
    <div data-element="cpu-option" className="selector-option">
      <div>
        <p data-element="option-label" className="selector-option-label">
          {option.label}
        </p>
        <p data-element="option-details" className="selector-option-details">
          {option.details}
        </p>
      </div>

      <div data-element="option-meta" className="selector-option-meta">
        {option.badge && (
          <span data-element="option-badge" className="selector-option-badge">
            {option.badge}
          </span>
        )}
        <span data-element="option-price" className="selector-option-price">
          {option.price}
        </span>
      </div>
    </div>
  )}
  styles={selectStyles}
/>

{cpuError && (
  <p role="alert" className="mt-3 text-sm text-red-600">
    {cpuError}. Make sure your backend is running.
  </p>
)}

              </div>
            </div>
          </Rnd>
        </section>
      </div>
    </main>
  )
}

export default BuildingPage