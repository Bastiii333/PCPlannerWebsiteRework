import { useMemo, useState } from 'react'
import CpuSelector from './components/CpuSelector'
import GpuSelector from './components/GpuSelector'
import MotherboardSelector from './components/MotherboardSelector'
import PsuSelector from './components/PsuSelector'
import RamSelector from './components/RamSelector'
import StorageSelector, { type StorageSelection } from './components/StorageSelector'
import type { PartOption } from './types/parts'
import { validateBuild, type BuildIssueSeverity } from './validation/buildValidator'

function BuildingPage() {
  const [selectedCpu, setSelectedCpu] = useState<PartOption | null>(null)
  const [selectedGpu, setSelectedGpu] = useState<PartOption | null>(null)
  const [selectedMotherboard, setSelectedMotherboard] = useState<PartOption | null>(null)
  const [selectedRam, setSelectedRam] = useState<Array<PartOption | null>>([])
  const [selectedPsu, setSelectedPsu] = useState<PartOption | null>(null)
  const [selectedStorage, setSelectedStorage] = useState<StorageSelection[]>([])

  const handleMotherboardChange = (option: PartOption | null) => {
    setSelectedMotherboard(option)
    setSelectedRam([])
    setSelectedStorage([])
  }

  const storageSummary = selectedStorage.reduce<Array<[string, PartOption | null]>>(
    (parts, selection) => {
      const storageIndex = selection.type === 'nvme'
        ? parts.filter(([label]) => label.startsWith('NVMe')).length + 1
        : parts.filter(([label]) => label.startsWith('SATA')).length + 1
      parts.push([
        selection.type === 'nvme' ? `NVMe slot ${storageIndex}` : `SATA port ${storageIndex}`,
        selection.part,
      ])
      return parts
    },
    []
  )

  const summaryParts: Array<[string, PartOption | null]> = [
    ['CPU', selectedCpu],
    ['GPU', selectedGpu],
    ['Motherboard', selectedMotherboard],
    ...selectedRam.map((part, index) => [`RAM slot ${index + 1}`, part] as [string, PartOption | null]),
    ['PSU', selectedPsu],
    ...storageSummary,
  ]
  const selectedCount = summaryParts.filter(([, part]) => part !== null).length
  const buildIssues = useMemo(
    () => validateBuild({
      cpu: selectedCpu,
      gpu: selectedGpu,
      motherboard: selectedMotherboard,
      ram: selectedRam,
      psu: selectedPsu,
      storage: selectedStorage,
    }),
    [selectedCpu, selectedGpu, selectedMotherboard, selectedRam, selectedPsu, selectedStorage]
  )
  const errorCount = buildIssues.filter((item) => item.severity === 'error').length
  const warningCount = buildIssues.filter((item) => item.severity === 'warning').length
  const issueStyles: Record<BuildIssueSeverity, string> = {
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  }

  return (
    <main
      id="building-page"
      data-component="BuildingPage"
      data-element="page-root"
      className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 lg:px-12"
    >
      <div id="building-container" data-element="page-container" className="mx-auto max-w-[1600px]">
        <header
          id="building-header"
          data-component="PageHeader"
          data-element="page-header"
          className="mb-8"
        >
          <p
            data-element="page-label"
            className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-violet-600"
          >
            PC Planner
          </p>
          <h1 data-element="page-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Build your PC
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Choose your components on the left to see the complete build specification on the right.
          </p>
        </header>

        <section
          id="build-content"
          data-component="BuildContent"
          data-element="build-content"
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]"
        >
          <div
            id="part-selection-panel"
            data-component="PartSelectionPanel"
            data-element="part-selection-panel"
            className="grid min-w-0 gap-4"
          >
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <CpuSelector
                selected={selectedCpu}
                onSelectedChange={setSelectedCpu}
                compatibleSocket={selectedMotherboard?.socket}
              />
              <MotherboardSelector
                selected={selectedMotherboard}
                onSelectedChange={handleMotherboardChange}
                compatibleSocket={selectedCpu?.socket}
              />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <GpuSelector selected={selectedGpu} onSelectedChange={setSelectedGpu} />
              <PsuSelector selected={selectedPsu} onSelectedChange={setSelectedPsu} />
            </div>
            <RamSelector
              slotCount={selectedMotherboard?.ramSlots ?? 0}
              ramType={selectedMotherboard?.ramType}
              selected={selectedRam}
              onSelectedChange={setSelectedRam}
            />
            <StorageSelector
              key={selectedMotherboard?.value ?? 'no-motherboard-storage'}
              m2Slots={selectedMotherboard?.m2Slots ?? 0}
              sataPorts={selectedMotherboard?.sataPorts ?? 0}
              selected={selectedStorage}
              onSelectedChange={setSelectedStorage}
            />
          </div>

          <aside
            id="build-summary"
            data-component="BuildSummaryCard"
            data-element="build-summary-card"
            className="min-w-0 lg:sticky lg:top-8"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
                  Build summary
                </p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">Your PC build</h2>
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {selectedCount}/{summaryParts.length} selected
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-500">
                  Review the selected components and their specifications here.
                </p>
              </div>
              <div
                id="build-health"
                data-component="BuildHealth"
                data-element="build-health"
                className="border-b border-slate-100 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-800">Build health</h3>
                  {errorCount === 0 && warningCount === 0 ? (
                    <span className="text-xs font-semibold text-emerald-600">No issues</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">
                      {errorCount > 0 ? `${errorCount} error${errorCount === 1 ? '' : 's'}` : ''}
                      {errorCount > 0 && warningCount > 0 ? ' · ' : ''}
                      {warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}
                    </span>
                  )}
                </div>
                <ul className="mt-3 space-y-2">
                  {buildIssues.map((buildIssue) => (
                    <li
                      key={buildIssue.id}
                      data-element="build-issue"
                      className={`rounded-xl border px-3 py-2.5 text-xs ${issueStyles[buildIssue.severity]}`}
                    >
                      <p className="font-semibold">{buildIssue.title}</p>
                      <p className="mt-1 leading-5">{buildIssue.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <ul
                id="build-summary-details"
                data-element="summary-details"
                className="divide-y divide-slate-100"
              >
                {summaryParts.map(([label, part]) => (
                  <li
                    key={`${label}-${part?.value ?? 'empty'}`}
                    data-element="summary-component"
                    className="px-5 py-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    {part ? (
                      <div className="mt-2">
                        <p className="text-sm font-semibold text-slate-800">{part.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{part.details}</p>
                        <p className="mt-2 text-xs font-medium text-slate-600">{part.price}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">Not selected</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}

export default BuildingPage
