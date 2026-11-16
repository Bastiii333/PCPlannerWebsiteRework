import type { PartOption } from '../types/parts'

export type BottleneckResult = {
  status: 'balanced' | 'warning' | 'bottleneck' | 'insufficient-data'
  severity: 'balanced' | 'warning' | 'critical'
  title: string
  message: string
  compatSeverity: 'good' | 'warn' | 'bad'
  cpuIndex?: number
  combinedGpuIndex?: number
}

export type CpuGpuCompatibility = Pick<
  BottleneckResult,
  'compatSeverity' | 'cpuIndex' | 'combinedGpuIndex'
>

type CompatibilityBand = {
  min: number
  max?: number
}

const compatibilityBands: Record<'nvidia' | 'amd' | 'intel', CompatibilityBand[]> = {
  nvidia: [{ min: 800, max: 1500 }, { min: 1600, max: 6000 }, { min: 6100, max: 12000 }, { min: 12100 }],
  amd: [{ min: 16, max: 30 }, { min: 31, max: 54 }, { min: 55, max: 84 }, { min: 85 }],
  intel: [{ min: 4, max: 8 }, { min: 9, max: 16 }, { min: 17, max: 32 }, { min: 33 }],
}

function bandIndex(value: number, bands: CompatibilityBand[]): number {
  return bands.findIndex((band) => value >= band.min && (band.max === undefined || value <= band.max))
}

function cpuBandIndex(coreCount: number): number {
  if (coreCount === 4) return 0
  if (coreCount === 6) return 1
  if (coreCount === 8) return 2
  return coreCount >= 9 ? 3 : -1
}

export function getCpuGpuCompatibility(
  cpu: PartOption | null,
  gpu: PartOption | null
): CpuGpuCompatibility {
  const cpuIndex = cpu?.coreCount !== undefined ? cpuBandIndex(cpu.coreCount) : undefined
  const combinedGpuIndex = gpu?.gpuManufacturer && gpu.gpuPerformanceMetric !== undefined
    ? bandIndex(gpu.gpuPerformanceMetric, compatibilityBands[gpu.gpuManufacturer])
    : undefined

  if (cpuIndex === undefined || combinedGpuIndex === undefined || cpuIndex < 0 || combinedGpuIndex < 0) {
    return { compatSeverity: 'warn', cpuIndex, combinedGpuIndex }
  }

  return {
    compatSeverity: combinedGpuIndex > cpuIndex + 1 ? 'bad' : cpuIndex === combinedGpuIndex ? 'good' : 'warn',
    cpuIndex,
    combinedGpuIndex,
  }
}

export function describeCpuGpuMismatch(compatibility: CpuGpuCompatibility): string {
  if (compatibility.cpuIndex === undefined || compatibility.cpuIndex < 0
    || compatibility.combinedGpuIndex === undefined || compatibility.combinedGpuIndex < 0) {
    return 'The CPU/GPU compatibility data is incomplete, so the balance could not be determined reliably.'
  }
  if (compatibility.cpuIndex !== undefined
    && compatibility.combinedGpuIndex !== undefined
    && compatibility.cpuIndex > compatibility.combinedGpuIndex) {
    return 'The CPU is in a higher performance tier than the GPU, so some CPU performance may go unused. Try selecting a more powerful GPU.'
  }
  return 'The GPU is in a higher performance tier than the CPU, so the CPU may limit GPU performance. Try selecting a CPU from a higher core tier.'
}

export function hasRamBottleneck(cpu: PartOption | null, ram: Array<PartOption | null>): boolean {
  const cpuMaxMemorySpeed = cpu?.maxMemorySpeed
  const highestRamFrequency = Math.max(...ram.map((part) => part?.memorySpeed ?? 0), 0)
  return cpuMaxMemorySpeed !== undefined
    && cpuMaxMemorySpeed > 0
    && highestRamFrequency > 0
    && highestRamFrequency > cpuMaxMemorySpeed + 50
}

export function hasMixedRamSpeeds(ram: Array<PartOption | null>): boolean {
  const speeds = ram
    .map((part) => part?.memorySpeed)
    .filter((speed): speed is number => speed !== undefined && Number.isFinite(speed) && speed > 0)
  return speeds.length >= 2 && new Set(speeds).size > 1
}

export function estimateBottleneck(cpu: PartOption | null, gpu: PartOption | null): BottleneckResult {
  if (!cpu || !gpu || cpu.coreCount === undefined
    || gpu.gpuManufacturer === undefined || gpu.gpuPerformanceMetric === undefined) {
    return {
      status: 'insufficient-data',
      severity: 'warning',
      title: 'Bottleneck estimate may not be accurate',
      message: 'Core-count or GPU architecture data is incomplete, so compatibility cannot be identified reliably.',
      compatSeverity: 'warn',
    }
  }

  const compatibility = getCpuGpuCompatibility(cpu, gpu)
  if (compatibility.compatSeverity === 'bad') {
    return {
      ...compatibility,
      status: 'bottleneck',
      severity: 'critical',
      title: 'CPU/GPU bottleneck detected',
      message: describeCpuGpuMismatch(compatibility),
    }
  }
  if (compatibility.compatSeverity === 'good') {
    return {
      ...compatibility,
      status: 'balanced',
      severity: 'balanced',
      title: 'Balanced CPU and GPU',
      message: 'The CPU core count and GPU performance tier are within the recommended compatibility range.',
    }
  }
  return {
    ...compatibility,
    status: 'warning',
    severity: 'warning',
    title: 'CPU/GPU compatibility warning',
    message: describeCpuGpuMismatch(compatibility),
  }
}

export function recommendCpus(
  cpus: PartOption[],
  gpu: PartOption | null,
  compatibleSocket?: string,
  currentCpu?: PartOption | null
): Array<PartOption & { recommendationReason: string }> {
  if (!gpu || !compatibleSocket) return []

  const currentCoreCount = currentCpu?.coreCount ?? 0
  return cpus
    .filter((cpu) => cpu.value !== currentCpu?.value
      && cpu.socket === compatibleSocket
      && (cpu.coreCount ?? 0) > currentCoreCount)
    .map((cpu) => ({ cpu, result: estimateBottleneck(cpu, gpu) }))
    .sort((left, right) =>
      Number(right.result.status !== 'balanced') - Number(left.result.status !== 'balanced')
      || (right.cpu.coreCount ?? 0) - (left.cpu.coreCount ?? 0)
    )
    .slice(0, 3)
    .map(({ cpu, result }) => ({
      ...cpu,
      recommendationReason: result.status === 'balanced'
        ? 'Balanced CPU/GPU compatibility'
        : 'Higher CPU core tier may reduce the GPU compatibility warning',
    }))
}

export function recommendGpus(
  gpus: PartOption[],
  cpu: PartOption | null,
  currentGpu: PartOption | null
): Array<PartOption & { recommendationReason: string }> {
  if (!cpu || !currentGpu || currentGpu.gpuManufacturer === undefined) return []

  const currentMetric = currentGpu.gpuPerformanceMetric ?? 0
  return gpus
    .filter((gpu) => gpu.value !== currentGpu.value
      && gpu.gpuManufacturer === currentGpu.gpuManufacturer
      && (gpu.gpuPerformanceMetric ?? 0) > currentMetric)
    .map((gpu) => ({ gpu, result: estimateBottleneck(cpu, gpu) }))
    .sort((left, right) =>
      Number(right.result.status === 'balanced') - Number(left.result.status === 'balanced')
      || (left.gpu.gpuPerformanceMetric ?? 0) - (right.gpu.gpuPerformanceMetric ?? 0)
    )
    .slice(0, 3)
    .map(({ gpu, result }) => ({
      ...gpu,
      recommendationReason: result.status === 'balanced'
        ? 'Balanced CPU/GPU compatibility'
        : 'Higher GPU tier may better match the selected CPU',
    }))
}
