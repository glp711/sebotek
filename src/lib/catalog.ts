import { demoBooks, demoStores } from '../data/demoCatalog'
import type {
  AuthIntent,
  BookDraft,
  BookRecord,
  CatalogPayload,
  ProfileRecord,
  StoreDraft,
  StoreRecord,
  WishlistRecord,
} from '../types'
import { isSupabaseConfigured, supabase } from './supabase'

const publicStoreColumns =
  'id,name,slug,description,address,city,state,zip_code,phone,opening_hours,photo_url,latitude,longitude,approved,created_at,updated_at'

const adminStoreColumns = `${publicStoreColumns},owner_id`

const legacyStoreColumns =
  'id,name,slug,description,address,city,state,zipCode,phone,openingHours,photoUrl,latitude,longitude,approved,ownerId,createdAt,updatedAt'

const publicProfileColumns = 'id,display_name,role,avatar_url,created_at,updated_at'

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

const normalizeProfile = (row: Record<string, unknown>): ProfileRecord => ({
  id: String(row.id),
  displayName: String(row.display_name ?? row.displayName ?? 'Leitor'),
  role: String(row.role ?? 'CUSTOMER') as ProfileRecord['role'],
  avatarUrl: nullableString(row.avatar_url ?? row.avatarUrl),
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

const normalizeWishlist = (row: Record<string, unknown>): WishlistRecord => ({
  id: String(row.id),
  userId: String(row.user_id ?? row.userId ?? ''),
  title: String(row.title ?? ''),
  author: nullableString(row.author),
  notified: Boolean(row.notified),
  createdAt: nullableString(row.created_at ?? row.createdAt) ?? undefined,
})

const nullableString = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

const nullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  return Number(value)
}

const cleanString = (value: string) => {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const bookDraftToRow = (draft: BookDraft) => ({
  title: draft.title.trim(),
  author: draft.author.trim(),
  isbn: cleanString(draft.isbn),
  category: cleanString(draft.category),
  summary: cleanString(draft.summary),
  publisher: cleanString(draft.publisher),
  published_year: draft.publishedYear ? Number(draft.publishedYear) : null,
  condition: draft.condition,
  price: Number(draft.price),
  quantity: Number(draft.quantity || 0),
  cover_url: cleanString(draft.coverUrl),
})

const getAuthRedirectUrl = (path: '/auth/confirm' | '/auth/reset-password', intent?: AuthIntent) => {
  const origin =
    typeof window === 'undefined' ? 'https://sebo-virtual.vercel.app' : window.location.origin
  const url = new URL(path, origin)
  if (intent) url.searchParams.set('intent', intent)
  return url.toString()
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

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  intent: AuthIntent = 'customer',
) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl('/auth/confirm', intent),
      data: {
        display_name: displayName,
        intent,
      },
    },
  })
  if (error) throw error
}

export async function sendPasswordReset(email: string, intent: AuthIntent = 'customer') {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl('/auth/reset-password', intent),
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function loadMyProfile(): Promise<ProfileRecord | null> {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(publicProfileColumns)
    .eq('id', user.id)
    .maybeSingle()

  if (error) return null
  return data ? normalizeProfile(data) : null
}

export async function updateMyProfile(displayName: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Entre na sua conta para editar o perfil.')

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)

  if (error) throw error
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

export async function loadAdminStores(): Promise<StoreRecord[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('stores')
    .select(adminStoreColumns)
    .order('approved', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => normalizeStore(row))
}

export async function setStoreApproval(storeId: string, approved: boolean) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  if (!storeId) throw new Error('Escolha um sebo para analisar.')

  const { error } = await supabase
    .from('stores')
    .update({ approved })
    .eq('id', storeId)

  if (error) throw error
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

  const { data: storeData, error: storeError } = await supabase
    .from('stores')
    .select('approved')
    .eq('id', storeId)
    .maybeSingle()

  if (storeError) throw storeError
  if (!storeData?.approved) {
    throw new Error('Seu sebo precisa ser aprovado pela administracao antes de cadastrar livros.')
  }

  const { error } = await supabase.from('books').insert({
    store_id: storeId,
    ...bookDraftToRow(draft),
  })

  if (error) throw error
}

export async function loadMyBooks(storeId: string): Promise<BookRecord[]> {
  if (!supabase || !storeId) return []

  const { data, error } = await supabase
    .from('books')
    .select(
      `id,title,author,isbn,category,summary,publisher,published_year,condition,price,quantity,cover_url,store_id,created_at,updated_at,stores(${publicStoreColumns})`,
    )
    .eq('store_id', storeId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => normalizeBook(row))
}

export async function updateBook(bookId: string, draft: BookDraft) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  if (!bookId) throw new Error('Escolha um livro para editar.')

  const { error } = await supabase.from('books').update(bookDraftToRow(draft)).eq('id', bookId)
  if (error) throw error
}

export async function deleteBook(bookId: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  if (!bookId) throw new Error('Escolha um livro para remover.')

  const { error } = await supabase.from('books').delete().eq('id', bookId)
  if (error) throw error
}

export async function loadMyWishlist(): Promise<WishlistRecord[]> {
  if (!supabase) return []
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('wishlists')
    .select('id,user_id,title,author,notified,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => normalizeWishlist(row))
}

export async function createWishlistItem(title: string, author: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Entre na sua conta para salvar uma busca.')

  const { error } = await supabase.from('wishlists').insert({
    user_id: user.id,
    title,
    author: author || null,
  })

  if (error) throw error
}

export async function deleteWishlistItem(id: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.from('wishlists').delete().eq('id', id)
  if (error) throw error
}

function uniqueStoresFromBooks(books: BookRecord[]) {
  const stores = new Map<string, StoreRecord>()
  for (const book of books) {
    if (book.store) stores.set(book.store.id, book.store)
  }
  return Array.from(stores.values())
}
