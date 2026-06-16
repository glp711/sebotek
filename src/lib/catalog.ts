import { demoBooks, demoStores } from '../data/demoCatalog'
import type {
  BookDraft,
  BookRecord,
  CatalogPayload,
  StoreDraft,
  StoreRecord,
} from '../types'
import { isSupabaseConfigured, supabase } from './supabase'

const publicStoreColumns =
  'id,name,slug,description,address,city,state,zip_code,phone,opening_hours,photo_url,latitude,longitude,approved,created_at,updated_at'

const legacyStoreColumns =
  'id,name,slug,description,address,city,state,zipCode,phone,openingHours,photoUrl,latitude,longitude,approved,ownerId,createdAt,updatedAt'

const normalizeStore = (row: Record<string, unknown>): StoreRecord => ({
  id: String(row.id),
  ownerId: nullableString(row.owner_id ?? row.ownerId) ?? undefined,
  name: String(row.name ?? ''),
  slug: String(row.slug ?? ''),
  description: nullableString(row.description),
  address: String(row.address ?? ''),
  city: String(row.city ?? ''),
  state: String(row.state ?? ''),
  zipCode: nullableString(row.zip_code ?? row.zipCode),
  phone: String(row.phone ?? ''),
  openingHours: nullableString(row.opening_hours ?? row.openingHours),
  photoUrl: nullableString(row.photo_url ?? row.photoUrl),
  latitude: nullableNumber(row.latitude),
  longitude: nullableNumber(row.longitude),
  approved: Boolean(row.approved),
  createdAt: nullableString(row.created_at ?? row.createdAt) ?? undefined,
  updatedAt: nullableString(row.updated_at ?? row.updatedAt) ?? undefined,
})

const normalizeBook = (row: Record<string, unknown>): BookRecord => {
  const rawStore = row.stores ?? row.Store ?? row.store
  return {
    id: String(row.id),
    title: String(row.title ?? ''),
    author: String(row.author ?? ''),
    isbn: nullableString(row.isbn),
    category: nullableString(row.category),
    summary: nullableString(row.summary),
    publisher: nullableString(row.publisher),
    publishedYear: nullableNumber(row.published_year ?? row.publishedYear),
    condition: String(row.condition ?? 'GOOD') as BookRecord['condition'],
    price: Number(row.price ?? 0),
    quantity: Number(row.quantity ?? 0),
    coverUrl: nullableString(row.cover_url ?? row.coverUrl),
    storeId: String(row.store_id ?? row.storeId ?? ''),
    createdAt: nullableString(row.created_at ?? row.createdAt) ?? undefined,
    updatedAt: nullableString(row.updated_at ?? row.updatedAt) ?? undefined,
    store:
      rawStore && typeof rawStore === 'object'
        ? normalizeStore(rawStore as Record<string, unknown>)
        : null,
  }
}

const nullableString = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

const nullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  return Number(value)
}

const filterCatalog = (books: BookRecord[], term: string) => {
  const search = term.trim().toLowerCase()
  if (!search) return books

  return books.filter((book) => {
    const haystack = [
      book.title,
      book.author,
      book.isbn,
      book.category,
      book.publisher,
      book.store?.name,
      book.store?.city,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(search)
  })
}

export async function loadCatalog(term = ''): Promise<CatalogPayload> {
  if (!supabase || !isSupabaseConfigured) {
    return {
      source: 'demo',
      books: filterCatalog(demoBooks, term),
      stores: demoStores,
    }
  }

  const { data: booksData, error: booksError } = await supabase
    .from('books')
    .select(`id,title,author,isbn,category,summary,publisher,published_year,condition,price,quantity,cover_url,store_id,created_at,updated_at,stores(${publicStoreColumns})`)
    .gt('quantity', 0)
    .order('created_at', { ascending: false })
    .limit(80)

  if (!booksError && booksData && booksData.length > 0) {
    const books = filterCatalog(booksData.map((row) => normalizeBook(row)), term)
    return {
      source: 'supabase',
      books,
      stores: uniqueStoresFromBooks(books),
    }
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from('Book')
    .select(`id,title,author,isbn,condition,price,quantity,coverUrl,storeId,createdAt,updatedAt,Store(${legacyStoreColumns})`)
    .gt('quantity', 0)
    .order('createdAt', { ascending: false })
    .limit(80)

  if (!legacyError && legacyData && legacyData.length > 0) {
    const books = filterCatalog(legacyData.map((row) => normalizeBook(row)), term)
    return {
      source: 'legacy',
      books,
      stores: uniqueStoresFromBooks(books),
    }
  }

  if (!booksError && booksData) {
    return {
      source: 'supabase',
      books: [],
      stores: [],
    }
  }

  return {
    source: 'demo',
    books: filterCatalog(demoBooks, term),
    stores: demoStores,
    error: legacyError?.message ?? booksError.message,
  }
}

export async function getCurrentSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function subscribeToAuth(callback: () => void) {
  if (!supabase) return () => undefined
  const { data } = supabase.auth.onAuthStateChange(() => callback())
  return () => data.subscription.unsubscribe()
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string, displayName: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function loadMyStore(): Promise<StoreRecord | null> {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('stores')
    .select(publicStoreColumns)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (error) return null
  return data ? normalizeStore(data) : null
}

export async function createStoreRequest(draft: StoreDraft) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Entre na sua conta para cadastrar um sebo.')

  const slug = draft.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const { error } = await supabase.from('stores').insert({
    owner_id: user.id,
    name: draft.name,
    slug,
    description: draft.description,
    address: draft.address,
    city: draft.city,
    state: draft.state,
    zip_code: draft.zipCode,
    phone: draft.phone,
    opening_hours: draft.openingHours,
    approved: false,
  })

  if (error) throw error
}

export async function createBook(storeId: string, draft: BookDraft) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  if (!storeId) throw new Error('Cadastre ou carregue seu sebo antes de cadastrar livros.')

  const { error } = await supabase.from('books').insert({
    store_id: storeId,
    title: draft.title,
    author: draft.author,
    isbn: draft.isbn || null,
    condition: draft.condition,
    price: Number(draft.price),
    quantity: Number(draft.quantity || 1),
  })

  if (error) throw error
}

function uniqueStoresFromBooks(books: BookRecord[]) {
  const stores = new Map<string, StoreRecord>()
  for (const book of books) {
    if (book.store) stores.set(book.store.id, book.store)
  }
  return Array.from(stores.values())
}
