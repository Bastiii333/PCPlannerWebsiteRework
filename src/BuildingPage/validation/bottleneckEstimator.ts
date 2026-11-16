import type { PartOption } from '../types/parts'

export type BottleneckResolution = '1080p' | '1440p' | '4k'
export type BottleneckWorkload = 'esports' | 'modern-games'

export type BottleneckProfile = {
  resolution: BottleneckResolution
  workload: BottleneckWorkload
  targetFps: number
}

export type BottleneckResult = {
  status: 'cpu-limited' | 'gpu-limited' | 'balanced' | 'insufficient-data'
  severity: 'balanced' | 'warning' | 'critical'
  title: string
  message: string
}

export type CpuRecommendation = PartOption & {
  recommendationReason: string
}

const gpuWeightByResolution: Record<BottleneckResolution, number> = {
  '1080p': 1,
  '1440p': 0.7,
  '4k': 0.4,
}
const CPU_REFERENCE_FPS = 200

export function estimateBottleneck(
  cpu: PartOption | null,
  gpu: PartOption | null,
  profile: BottleneckProfile
): BottleneckResult {
  if (!cpu || !gpu
    || cpu.benchmarkScore === undefined || gpu.benchmarkScore === undefined
    || !Number.isFinite(cpu.benchmarkScore) || !Number.isFinite(gpu.benchmarkScore)
    || cpu.benchmarkScore <= 0 || gpu.benchmarkScore <= 0
    || !Number.isFinite(profile.targetFps) || profile.targetFps <= 0) {
    return {
      status: 'insufficient-data',
      severity: 'warning',
      title: 'Bottleneck estimate may not be accurate',
      message: 'Performance data is incomplete, so the possible bottleneck cannot be identified reliably.',
    }
  }

  const cpuDemand = (profile.targetFps / CPU_REFERENCE_FPS)
    * (profile.workload === 'esports' ? 1.15 : 1)
  const gpuCapacity = gpu.benchmarkScore * gpuWeightByResolution[profile.resolution]
  const ratio = gpuCapacity * cpuDemand / Math.max(cpu.benchmarkScore, 1)

  if (ratio >= 1.2) {
    return {
      status: 'cpu-limited',
      severity: ratio >= 2 ? 'critical' : 'warning',
      title: ratio >= 2 ? 'Severe CPU bottleneck' : 'Likely CPU bottleneck',
      message: `Likely cause: CPU. At ${profile.resolution} and ${profile.targetFps} FPS, it may limit this GPU in ${profile.workload === 'esports' ? 'high-refresh esports' : 'CPU-heavy'} workloads.`,
    }
  }
  if (ratio <= 0.85) {
    return {
      status: 'gpu-limited',
      severity: ratio <= 0.8 ? 'critical' : 'warning',
      title: ratio <= 0.8 ? 'Severe GPU bottleneck' : 'Likely GPU bottleneck',
      message: `Likely cause: GPU. At ${profile.resolution} and ${profile.targetFps} FPS, the GPU is likely to be the limiting component.`,
    }
  }
  return {
    status: 'balanced',
    severity: 'balanced',
    title: 'Generally balanced',
    message: `Likely cause: neither component. The CPU and GPU are reasonably balanced for ${profile.resolution} at ${profile.targetFps} FPS.`,
  }
}

export function recommendCpus(
  cpus: PartOption[],
  gpu: PartOption | null,
  profile: BottleneckProfile,
  compatibleSocket?: string,
  currentCpu?: PartOption | null
): CpuRecommendation[] {
  if (!gpu || !compatibleSocket) return []

  const currentScore = currentCpu?.benchmarkScore
  const candidates = cpus
    .filter((cpu) =>
      cpu.value !== currentCpu?.value
      && cpu.socket === compatibleSocket
      && cpu.benchmarkScore !== undefined
      && (currentScore === undefined || cpu.benchmarkScore > currentScore)
    )
    .map((cpu) => ({
      cpu,
      result: estimateBottleneck(cpu, gpu, profile),
    }))
    .sort((left, right) =>
      Number(right.result.status !== 'balanced') - Number(left.result.status !== 'balanced')
      || (right.cpu.benchmarkScore ?? 0) - (left.cpu.benchmarkScore ?? 0)
    )
    .slice(0, 3)

  return candidates.map(({ cpu, result }) => ({
    ...cpu,
    recommendationReason: result.status === 'balanced'
      ? `Balanced for ${profile.resolution} at ${profile.targetFps} FPS`
      : `Reduces the CPU bottleneck at ${profile.resolution} and ${profile.targetFps} FPS`,
  }))
}
