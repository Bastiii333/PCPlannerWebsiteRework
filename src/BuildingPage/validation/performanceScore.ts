import type { PartRecord } from '../types/parts'

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function estimateCpuPerformanceScore(cpu: PartRecord): number | undefined {
  const cores = cpu.cores && typeof cpu.cores === 'object'
    ? numberValue((cpu.cores as Record<string, unknown>).performance)
      ?? numberValue((cpu.cores as Record<string, unknown>).total)
    : undefined
  const clocks = cpu.clocks && typeof cpu.clocks === 'object'
    ? (cpu.clocks as Record<string, unknown>).performance
    : undefined
  const performanceClocks = clocks && typeof clocks === 'object'
    ? clocks as Record<string, unknown>
    : undefined
  const boostClock = numberValue(performanceClocks?.boost)
    ?? numberValue(performanceClocks?.base)

  if (cores === undefined || boostClock === undefined) return undefined

  return Math.sqrt(cores) * boostClock * 40
}

export function estimateGpuPerformanceScore(gpu: PartRecord): number | undefined {
  const coreClock = numberValue(gpu.core_boost_clock) ?? numberValue(gpu.core_base_clock)
  const memorySize = numberValue(gpu.memory)
  const memoryClock = numberValue(gpu.effective_memory_clock)
  const memoryBus = numberValue(gpu.memory_bus)

  if (coreClock === undefined || memorySize === undefined || memoryClock === undefined) {
    return undefined
  }

  const memoryThroughput = memoryBus !== undefined
    ? memoryBus * memoryClock / 8 / 1000
    : memorySize * memoryClock / 8 / 1000

  return Math.sqrt((coreClock / 1000) * memoryThroughput) * 333
}
