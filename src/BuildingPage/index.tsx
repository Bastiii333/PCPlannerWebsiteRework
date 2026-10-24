import { useState } from 'react'
import CpuSelector from './components/CpuSelector'
import GpuSelector from './components/GpuSelector'
import MotherboardSelector from './components/MotherboardSelector'
import PsuSelector from './components/PsuSelector'
import RamSelector from './components/RamSelector'
import type { PartOption } from './types/parts'

function BuildingPage() {
  const [selectedCpu, setSelectedCpu] = useState<PartOption | null>(null)
  const [selectedMotherboard, setSelectedMotherboard] = useState<PartOption | null>(null)

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
          <CpuSelector
            selected={selectedCpu}
            onSelectedChange={setSelectedCpu}
            compatibleSocket={selectedMotherboard?.socket}
          />
          <GpuSelector />
          <MotherboardSelector
            selected={selectedMotherboard}
            onSelectedChange={setSelectedMotherboard}
            compatibleSocket={selectedCpu?.socket}
          />
          <RamSelector
            key={selectedMotherboard?.value ?? 'no-motherboard'}
            slotCount={selectedMotherboard?.ramSlots ?? 0}
            ramType={selectedMotherboard?.ramType}
          />
          <PsuSelector />
        </section>
      </div>
    </main>
  )
}

export default BuildingPage
