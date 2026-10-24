export type PartOption = {
  value: string
  label: string
  details: string
  price: string
  badge?: string
  socket?: string
  ramType?: string
  ramSlots?: number
}

export type PartRecord = {
  opendb_id?: string
  metadata?: {
    name?: string
    manufacturer?: string
  }
  [key: string]: unknown
}
