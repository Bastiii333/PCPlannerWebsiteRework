import { useMemo, useState } from 'react'
import CpuSelector from './components/CpuSelector'
import GpuSelector from './components/GpuSelector'
import MotherboardSelector from './components/MotherboardSelector'
import PsuSelector from './components/PsuSelector'
import RamSelector from './components/RamSelector'
import StorageSelector, { type StorageSelection } from './components/StorageSelector'
import type { PartOption } from './types/parts'
import { validateBuild, type BuildIssueSeverity } from './validation/buildValidator'
import {
  estimateBottleneck,
  type BottleneckResolution,
  type BottleneckWorkload,
} from './validation/bottleneckEstimator'

function BuildingPage() {
  const [selectedCpu, setSelectedCpu] = useState<PartOption | null>(null)
  const [selectedGpu, setSelectedGpu] = useState<PartOption | null>(null)
  const [selectedMotherboard, setSelectedMotherboard] = useState<PartOption | null>(null)
  const [selectedRam, setSelectedRam] = useState<Array<PartOption | null>>([])
  const [selectedPsu, setSelectedPsu] = useState<PartOption | null>(null)
  const [selectedStorage, setSelectedStorage] = useState<StorageSelection[]>([])
  const [resolution, setResolution] = useState<BottleneckResolution>('1440p')
  const [workload, setWorkload] = useState<BottleneckWorkload>('modern-games')
  const [targetFps, setTargetFps] = useState(144)

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
  const bottleneck = estimateBottleneck(selectedCpu, selectedGpu, {
    resolution,
    workload,
    targetFps,
  })
  const displayedBuildIssues = useMemo(() => {
    if (bottleneck.status === 'balanced' || bottleneck.status === 'insufficient-data') {
      return buildIssues
    }

    const component = bottleneck.status === 'cpu-limited' ? 'CPU' : 'GPU'
    const severity: BuildIssueSeverity = bottleneck.severity === 'critical' ? 'error' : 'warning'
    return [
      ...buildIssues.filter((buildIssue) => buildIssue.id !== 'performance-balance'),
      {
        id: 'bottleneck-estimate',
        severity,
        title: bottleneck.severity === 'critical'
          ? `Severe ${component} bottleneck detected`
          : `Likely ${component} bottleneck detected`,
        message: bottleneck.message,
        parts: ['CPU', 'GPU'],
      },
    ]
  }, [bottleneck, buildIssues])
  const errorCount = displayedBuildIssues.filter((item) => item.severity === 'error').length
  const warningCount = displayedBuildIssues.filter((item) => item.severity === 'warning').length
  const issueStyles: Record<BuildIssueSeverity, string> = {
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  }
  const bottleneckStyles = {
    balanced: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    critical: 'border-red-200 bg-red-50',
  } as const

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
          <p data-element="page-description" className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
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
            <div data-element="core-part-selection-row" className="grid min-w-0 gap-4 xl:grid-cols-2">
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
            <div data-element="power-part-selection-row" className="grid min-w-0 gap-4 xl:grid-cols-2">
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
            <div data-element="build-summary-content" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div data-element="build-summary-header" className="border-b border-slate-100 bg-slate-50 px-5 py-5">
                <p data-element="summary-label" className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">
                  Build summary
                </p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <h2 data-element="summary-title" className="text-xl font-bold tracking-tight text-slate-900">Your PC build</h2>
                  <span data-element="summary-selection-count" className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                    {selectedCount}/{summaryParts.length} selected
                  </span>
                </div>
                <p data-element="summary-description" className="mt-2 text-sm leading-5 text-slate-500">
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
                  <h3 data-element="build-health-title" className="text-sm font-bold text-slate-800">Build health</h3>
                  {errorCount === 0 && warningCount === 0 ? (
                    <span data-element="build-health-status" className="text-xs font-semibold text-emerald-600">No issues</span>
                  ) : (
                    <span data-element="build-health-status" className="text-xs font-semibold text-slate-500">
                      {errorCount > 0 ? `${errorCount} error${errorCount === 1 ? '' : 's'}` : ''}
                      {errorCount > 0 && warningCount > 0 ? ' · ' : ''}
                      {warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}
                    </span>
                  )}
                </div>
                <ul className="mt-3 space-y-2">
                  {displayedBuildIssues.map((buildIssue) => (
                    <li
                      key={buildIssue.id}
                      data-element="build-issue"
                      className={`rounded-xl border px-3 py-2.5 text-xs ${issueStyles[buildIssue.severity]}`}
                    >
                      <p data-element="build-issue-title" className="font-semibold">{buildIssue.title}</p>
                      <p data-element="build-issue-message" className="mt-1 leading-5">{buildIssue.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div data-element="bottleneck-section" className="border-b border-slate-100 p-5">
                <h3 data-element="bottleneck-title-label" className="text-sm font-bold text-slate-800">Bottleneck estimate</h3>
                <div data-element="bottleneck-target-controls" className="mt-3 grid grid-cols-2 gap-2">
                  <label data-element="resolution-control" className="text-xs font-semibold text-slate-600">
                    Resolution
                    <select
                      value={resolution}
                      onChange={(event) => setResolution(event.target.value as BottleneckResolution)}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-normal"
                    >
                      <option value="1080p">1080p</option>
                      <option value="1440p">1440p</option>
                      <option value="4k">4K</option>
                    </select>
                  </label>
                  <label data-element="target-fps-control" className="text-xs font-semibold text-slate-600">
                    Target FPS
                    <select
                      value={targetFps}
                      onChange={(event) => setTargetFps(Number(event.target.value))}
                      className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-normal"
                    >
                      <option value={60}>60</option>
                      <option value={144}>144</option>
                      <option value={240}>240</option>
                    </select>
                  </label>
                </div>
                <label data-element="workload-control" className="mt-2 block text-xs font-semibold text-slate-600">
                  Workload
                  <select
                    value={workload}
                    onChange={(event) => setWorkload(event.target.value as BottleneckWorkload)}
                    className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-normal"
                  >
                    <option value="modern-games">Modern games</option>
                    <option value="esports">High-refresh esports</option>
                  </select>
                </label>
                <div
                  data-element="bottleneck-result"
                  className={`mt-3 rounded-xl border px-3 py-2.5 ${bottleneckStyles[bottleneck.severity]}`}
                >
                  <p data-element="bottleneck-title" className="text-xs font-semibold text-slate-800">{bottleneck.title}</p>
                  <p data-element="bottleneck-message" className="mt-1 text-xs leading-5 text-slate-600">{bottleneck.message}</p>
                </div>
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
                    <p data-element="summary-component-label" className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    {part ? (
                      <div data-element="summary-component-details" className="mt-2">
                        <p data-element="summary-component-name" className="text-sm font-semibold text-slate-800">{part.label}</p>
                        <p data-element="summary-component-description" className="mt-1 text-xs leading-5 text-slate-500">{part.details}</p>
                        <p data-element="summary-component-price" className="mt-2 text-xs font-medium text-slate-600">{part.price}</p>
                      </div>
                    ) : (
                      <p data-element="summary-component-empty" className="mt-2 text-sm text-slate-400">Not selected</p>
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
