export type StorageType = 'nvme' | 'ssd' | 'hdd'

export type PartOption = {
  value: string
  label: string
  details: string
  price: string
  badge?: string
  socket?: string
  ramType?: string
  ramSlots?: number
  m2Slots?: number
  sataPorts?: number
  storageType?: StorageType
  capacity?: number
  interface?: string
  formFactor?: string
  powerDraw?: number
  wattage?: number
  memoryCapacity?: number
  memorySpeed?: number
  maxMemoryCapacity?: number
  maxMemorySpeed?: number
  supportedRamTypes?: string[]
  hasIntegratedGraphics?: boolean
  benchmarkScore?: number
}

export type PartRecord = {
  opendb_id?: string
  metadata?: {
    name?: string
    manufacturer?: string
  }
  [key: string]: unknown
}
