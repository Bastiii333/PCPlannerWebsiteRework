import type { PartOption } from '../types/parts'
import type { StorageSelection } from '../components/StorageSelector'

export type BuildIssueSeverity = 'error' | 'warning' | 'info'

export type BuildIssue = {
  id: string
  severity: BuildIssueSeverity
  title: string
  message: string
  parts: string[]
}

export type BuildSelection = {
  cpu: PartOption | null
  gpu: PartOption | null
  motherboard: PartOption | null
  ram: Array<PartOption | null>
  psu: PartOption | null
  storage: StorageSelection[]
}

const issue = (
  id: string,
  severity: BuildIssueSeverity,
  title: string,
  message: string,
  parts: string[]
): BuildIssue => ({ id, severity, title, message, parts })

export function validateBuild(build: BuildSelection): BuildIssue[] {
  const issues: BuildIssue[] = []
  const populatedRam = build.ram.filter((part): part is PartOption => part !== null)
  const populatedStorage = build.storage.filter((selection) => selection.part !== null)
  const sataStorage = build.storage.filter((selection) => selection.type !== 'nvme' && selection.part !== null)
  const m2Storage = build.storage.filter((selection) => selection.type === 'nvme' && selection.part !== null)

  if (!build.cpu) {
    issues.push(issue('missing-cpu', 'error', 'CPU is missing', 'Select a CPU before completing this build.', ['CPU']))
  }
  if (!build.motherboard) {
    issues.push(issue('missing-motherboard', 'error', 'Motherboard is missing', 'Select a motherboard so compatibility can be checked.', ['Motherboard']))
  }
  if (populatedRam.length === 0) {
    issues.push(issue('missing-memory', 'error', 'Memory is missing', 'Select at least one RAM module.', ['RAM']))
  }
  if (!build.psu) {
    issues.push(issue('missing-psu', 'error', 'Power supply is missing', 'Select a PSU for power and connector checks.', ['PSU']))
  }
  if (!build.gpu && !build.cpu?.hasIntegratedGraphics) {
    issues.push(issue('missing-gpu', 'warning', 'Graphics output may be missing', 'No GPU is selected and the CPU does not report integrated graphics.', ['CPU', 'GPU']))
  }

  if (build.cpu && build.motherboard && build.cpu.socket && build.motherboard.socket
    && build.cpu.socket !== build.motherboard.socket) {
    issues.push(issue(
      'cpu-motherboard-socket',
      'error',
      'CPU and motherboard sockets do not match',
      `The CPU uses ${build.cpu.socket}, but the motherboard uses ${build.motherboard.socket}.`,
      ['CPU', 'Motherboard']
    ))
  }

  if (build.motherboard && populatedRam.length > 0) {
    const incompatibleType = populatedRam.find((part) =>
      part.ramType && build.motherboard?.ramType && part.ramType !== build.motherboard.ramType
    )
    if (incompatibleType) {
      issues.push(issue(
        'ram-type',
        'error',
        'RAM type is incompatible',
        `${incompatibleType.label} uses ${incompatibleType.ramType}, but the motherboard requires ${build.motherboard.ramType}.`,
        ['RAM', 'Motherboard']
      ))
    }
    if (build.cpu?.supportedRamTypes && populatedRam.some((part) =>
      part.ramType && !build.cpu?.supportedRamTypes?.includes(part.ramType)
    )) {
      issues.push(issue(
        'cpu-ram-type',
        'error',
        'RAM type is not supported by the CPU',
        `The selected CPU supports ${build.cpu.supportedRamTypes.join(', ')}, but at least one selected RAM module uses a different memory type.`,
        ['CPU', 'RAM']
      ))
    }

    if (build.motherboard.ramSlots !== undefined && build.ram.length > build.motherboard.ramSlots) {
      issues.push(issue(
        'ram-slots',
        'error',
        'Too many RAM modules',
        `The motherboard has ${build.motherboard.ramSlots} RAM slots, but ${build.ram.length} are configured.`,
        ['RAM', 'Motherboard']
      ))
    }

    const totalCapacity = populatedRam.reduce((total, part) => total + (part.memoryCapacity ?? 0), 0)
    if (totalCapacity > 0 && build.motherboard.maxMemoryCapacity !== undefined
      && totalCapacity > build.motherboard.maxMemoryCapacity) {
      issues.push(issue(
        'ram-capacity',
        'error',
        'Memory capacity exceeds motherboard support',
        `${totalCapacity}GB is selected, but the motherboard supports up to ${build.motherboard.maxMemoryCapacity}GB.`,
        ['RAM', 'Motherboard']
      ))
    }
    if (totalCapacity > 0 && build.cpu?.maxMemoryCapacity !== undefined
      && totalCapacity > build.cpu.maxMemoryCapacity) {
      issues.push(issue(
        'cpu-ram-capacity',
        'error',
        'Memory capacity exceeds CPU support',
        `${totalCapacity}GB is selected, but the CPU supports up to ${build.cpu.maxMemoryCapacity}GB.`,
        ['CPU', 'RAM']
      ))
    }
  }

  if (build.motherboard && m2Storage.length > 0 && build.motherboard.m2Slots !== undefined
    && m2Storage.length > build.motherboard.m2Slots) {
    issues.push(issue(
      'm2-slots',
      'error',
      'Too many NVMe drives',
      `${m2Storage.length} NVMe drives are selected, but the motherboard has ${build.motherboard.m2Slots} M.2 slots.`,
      ['NVMe', 'Motherboard']
    ))
  }
  if (build.motherboard && sataStorage.length > 0 && build.motherboard.sataPorts !== undefined
    && sataStorage.length > build.motherboard.sataPorts) {
    issues.push(issue(
      'sata-ports',
      'error',
      'Too many SATA drives',
      `${sataStorage.length} SATA drives are selected, but the motherboard has ${build.motherboard.sataPorts} SATA ports.`,
      ['SSD/HDD', 'Motherboard']
    ))
  }
  if (populatedStorage.length === 0) {
    issues.push(issue('no-storage', 'info', 'No storage selected', 'Add an NVMe, SSD, or hard drive to install an operating system and store files.', ['Storage']))
  }

  if (build.psu) {
    const estimatedPower = (build.cpu?.powerDraw ?? 65)
      + (build.gpu?.powerDraw ?? 0)
      + populatedRam.length * 5
      + populatedStorage.length * 10
      + 50
    if (build.psu.wattage !== undefined) {
      const recommendedPower = Math.ceil(estimatedPower * 1.25)
      if (build.psu.wattage < estimatedPower) {
        issues.push(issue(
          'psu-insufficient',
          'error',
          'PSU wattage is too low',
          `Estimated system draw is about ${estimatedPower}W, but the selected PSU is rated for ${build.psu.wattage}W.`,
          ['PSU', 'CPU', 'GPU']
        ))
      } else if (build.psu.wattage < recommendedPower) {
        issues.push(issue(
          'psu-headroom',
          'warning',
          'PSU headroom is low',
          `A PSU of at least ${recommendedPower}W is recommended for an estimated ${estimatedPower}W system draw.`,
          ['PSU', 'CPU', 'GPU']
        ))
      }
    }
  }

  if (build.cpu && build.gpu && build.cpu.powerDraw !== undefined && build.gpu.powerDraw !== undefined) {
    const ratio = build.gpu.powerDraw / Math.max(build.cpu.powerDraw, 1)
    if (ratio >= 4) {
      issues.push(issue(
        'performance-balance',
        'warning',
        'Potential CPU/GPU performance imbalance',
        'This GPU is substantially higher power than the CPU. Performance may be CPU-limited in high-refresh or CPU-heavy workloads; verify with workload-specific benchmarks.',
        ['CPU', 'GPU']
      ))
    }
  }

  return issues
}
