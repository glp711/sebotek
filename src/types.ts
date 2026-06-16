export type CatalogSource = 'supabase' | 'legacy' | 'demo'

export type BookCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR'

export type StoreRecord = {
  id: string
  ownerId?: string
  name: string
  slug: string
  description?: string | null
  address: string
  city: string
  state: string
  zipCode?: string | null
  phone: string
  openingHours?: string | null
  photoUrl?: string | null
  latitude?: number | null
  longitude?: number | null
  approved: boolean
  createdAt?: string
  updatedAt?: string
}

export type BookRecord = {
  id: string
  title: string
  author: string
  isbn?: string | null
  category?: string | null
  summary?: string | null
  publisher?: string | null
  publishedYear?: number | null
  condition: BookCondition
  price: number
  quantity: number
  coverUrl?: string | null
  storeId: string
  createdAt?: string
  updatedAt?: string
  store?: StoreRecord | null
}

export type CatalogPayload = {
  books: BookRecord[]
  stores: StoreRecord[]
  source: CatalogSource
  error?: string
}

export type StoreDraft = {
  name: string
  description: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  openingHours: string
}

export type BookDraft = {
  title: string
  author: string
  isbn: string
  condition: BookCondition
  price: string
  quantity: string
}
