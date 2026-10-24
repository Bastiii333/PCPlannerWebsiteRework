import { useRef, useState } from 'react'
import CpuSelector from './components/CpuSelector'
import GpuSelector from './components/GpuSelector'
import MotherboardSelector from './components/MotherboardSelector'
import PsuSelector from './components/PsuSelector'
import RamSelector from './components/RamSelector'
import type { PartOption } from './types/parts'

function BuildingPage() {
  const [selectedCpu, setSelectedCpu] = useState<PartOption | null>(null)
  const [selectedMotherboard, setSelectedMotherboard] = useState<PartOption | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const panRef = useRef({
    active: false,
    pointerX: 0,
    pointerY: 0,
    startX: 0,
    startY: 0,
  })

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    panRef.current = {
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: canvasPosition.x,
      startY: canvasPosition.y,
    }
    setIsPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) {
      return
    }

    setCanvasPosition({
      x: panRef.current.startX + event.clientX - panRef.current.pointerX,
      y: panRef.current.startY + event.clientY - panRef.current.pointerY,
    })
  }

  const stopCanvasPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    panRef.current.active = false
    setIsPanning(false)
  }

  const updateZoom = (amount: number) => {
    setZoom((currentZoom) =>
      Math.min(2, Math.max(0.4, Number((currentZoom + amount).toFixed(2))))
    )
  }

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    updateZoom(event.deltaY < 0 ? 0.1 : -0.1)
  }

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
          className="relative h-[calc(100vh-10rem)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
        >
          <div
            data-element="build-canvas-viewport"
            className="relative h-full overflow-hidden"
            onWheel={handleCanvasWheel}
            style={{ touchAction: 'none' }}
          >
            <div className="absolute right-4 top-4 z-50 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
              <button
                type="button"
                aria-label="Zoom out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => updateZoom(-0.1)}
              >
                −
              </button>
              <span className="min-w-12 text-center text-xs font-semibold text-slate-600">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => updateZoom(0.1)}
              >
                +
              </button>
              <button
                type="button"
                aria-label="Reset canvas view"
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setCanvasPosition({ x: 0, y: 0 })
                  setZoom(1)
                }}
              >
                Reset
              </button>
            </div>
            <div
              data-element="build-canvas"
              className="absolute left-1/2 top-1/2 h-[3000px] w-[4000px] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]"
              style={{
                touchAction: 'none',
                transform: `translate(calc(-50% + ${canvasPosition.x}px), calc(-50% + ${canvasPosition.y}px)) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              <p className="pointer-events-none absolute left-6 top-6 text-sm text-slate-400">
                Hold and drag the blank canvas to navigate
              </p>
              <div
                data-element="build-canvas-content"
                className="relative h-full min-h-[3000px] min-w-[4000px]"
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={stopCanvasPanning}
                onPointerCancel={stopCanvasPanning}
                style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
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
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default BuildingPage
