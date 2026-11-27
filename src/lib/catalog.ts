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
import { isSlugConflict, slugify, slugWithSuffix } from './slug'
import { isSupabaseConfigured, supabase } from './supabase'
import { LIMITS, validateBookDraft, validateStoreDraft } from './validation'

const publicStoreColumns =
  'id,name,slug,description,address,city,state,zip_code,phone,opening_hours,photo_url,latitude,longitude,approved,created_at,updated_at'

const adminStoreColumns = `${publicStoreColumns},owner_id`

const legacyStoreColumns =
  'id,name,slug,description,address,city,state,zipCode,phone,openingHours,photoUrl,latitude,longitude,approved,ownerId,createdAt,updatedAt'

const publicProfileColumns =
  'id,display_name,role,avatar_url,created_at,updated_at'

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
    conditionNotes: String(row.condition_notes ?? ''),
    copyPhotos: Array.isArray(row.copy_photos)
      ? row.copy_photos.filter(
          (p): p is string => typeof p === 'string' && /^https:\/\//i.test(p),
        )
      : [],
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

const bookDraftToRow = (draft: BookDraft) => {
  const invalid = validateBookDraft(draft)
  if (invalid) throw new Error(invalid)
  return {
    title: draft.title.trim(),
    author: draft.author.trim(),
    isbn: cleanString(draft.isbn),
    category: cleanString(draft.category),
    summary: cleanString(draft.summary),
    publisher: cleanString(draft.publisher),
    published_year: draft.publishedYear ? Number(draft.publishedYear) : null,
    condition: draft.condition,
    condition_notes: draft.conditionNotes?.trim() ?? '',
    copy_photos: draft.copyPhotos ?? [],
    price: Number(draft.price.replace(',', '.')),
    quantity: Number(draft.quantity || 0),
    cover_url: cleanString(draft.coverUrl),
  }
}

const productionOrigin = 'https://sebo-virtual.vercel.app'
export const oauthIntentStorageKey = 'sebo-virtual:oauth-intent'

const getAuthOrigin = () => {
  const configuredOrigin =
    import.meta.env.VITE_AUTH_REDIRECT_ORIGIN?.trim() ||
    import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '')

  if (typeof window === 'undefined') return productionOrigin

  const currentOrigin = window.location.origin
  const isLocal =
    currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1')
  return isLocal ? productionOrigin : currentOrigin
}

const getAuthRedirectUrl = (
  path: '/auth/confirm' | '/auth/reset-password' | '/auth/oauth',
  intent?: AuthIntent,
) => {
  const origin = getAuthOrigin()
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
    .select(`*,stores!inner(${publicStoreColumns})`)
    .gt('quantity', 0)
    .eq('stores.approved', true)
    .order('created_at', { ascending: false })
    .limit(1000)
    .abortSignal(AbortSignal.timeout(15000))

  if (!booksError && booksData) {
    const books = filterCatalog(
      booksData.map((row) => normalizeBook(row)),
      term,
    )
    const { data: storesData, error: storesError } = await supabase
      .from('stores')
      .select(publicStoreColumns)
      .eq('approved', true)
      .order('name')
      .abortSignal(AbortSignal.timeout(15000))
    return {
      source: 'supabase',
      books,
      stores: storesError
        ? uniqueStoresFromBooks(books)
        : (storesData ?? []).map(normalizeStore),
      error: storesError
        ? 'A lista completa de sebos não pôde ser atualizada.'
        : undefined,
    }
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from('Book')
    .select(
      `id,title,author,isbn,condition,price,quantity,coverUrl,storeId,createdAt,updatedAt,Store(${legacyStoreColumns})`,
    )
    .gt('quantity', 0)
    .order('createdAt', { ascending: false })
    .limit(80)
    .abortSignal(AbortSignal.timeout(10000))

  if (!legacyError && legacyData && legacyData.length > 0) {
    const books = filterCatalog(
      legacyData.map((row) => normalizeBook(row)),
      term,
    )
    return {
      source: 'legacy',
      books,
      stores: uniqueStoresFromBooks(books),
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

export async function signInWithGoogle(intent: AuthIntent = 'customer') {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')

  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(oauthIntentStorageKey, intent)
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl('/auth/oauth'),
    },
  })

  if (error) {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(oauthIntentStorageKey)
    }
    throw error
  }
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

export async function verifySignupCode(email: string, token: string) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email',
  })
  if (error) throw error
}

export async function resendSignupCode(
  email: string,
  intent: AuthIntent = 'customer',
) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: {
      emailRedirectTo: getAuthRedirectUrl('/auth/confirm', intent),
    },
  })
  if (error) throw error
}

export async function sendPasswordReset(
  email: string,
  intent: AuthIntent = 'customer',
) {
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

  const name = displayName.trim()
  if (!name) throw new Error('Informe o nome que será exibido.')
  if (name.length > LIMITS.displayName)
    throw new Error(
      `O nome pode ter no máximo ${LIMITS.displayName} caracteres.`,
    )

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name })
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

  const invalid = validateStoreDraft(draft)
  if (invalid) throw new Error(invalid)

  const name = draft.name.trim()
  const row = {
    owner_id: user.id,
    name,
    description: cleanString(draft.description),
    address: draft.address.trim(),
    city: draft.city.trim(),
    state: draft.state.trim().toUpperCase(),
    zip_code: cleanString(draft.zipCode),
    phone: draft.phone.trim(),
    opening_hours: cleanString(draft.openingHours),
    approved: false,
  }

  // Dois sebos podem ter o mesmo nome; o slug precisa ser \u00fanico.
  // Tenta o slug simples e, se j\u00e1 estiver em uso, gera um com sufixo.
  const candidates = [slugify(name), slugWithSuffix(name), slugWithSuffix(name)]
  for (const [attempt, slug] of candidates.entries()) {
    const { error } = await supabase.from('stores').insert({ ...row, slug })
    if (!error) return
    if (!isSlugConflict(error) || attempt === candidates.length - 1) throw error
  }
}

export async function createBook(storeId: string, draft: BookDraft) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  if (!storeId)
    throw new Error('Cadastre ou carregue seu sebo antes de cadastrar livros.')

  const { data: storeData, error: storeError } = await supabase
    .from('stores')
    .select('approved')
    .eq('id', storeId)
    .maybeSingle()

  if (storeError) throw storeError
  if (!storeData?.approved) {
    throw new Error(
      'Seu sebo precisa ser aprovado pela administração antes de cadastrar livros.',
    )
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
    .select(`*,stores(${publicStoreColumns})`)
    .eq('store_id', storeId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => normalizeBook(row))
}

export async function updateBook(
  bookId: string,
  draft: BookDraft,
  updatedAt?: string,
) {
  if (!supabase) throw new Error('Configure o Supabase no arquivo .env.local.')
  if (!bookId) throw new Error('Escolha um livro para editar.')

  let query = supabase
    .from('books')
    .update(bookDraftToRow(draft))
    .eq('id', bookId)
  if (updatedAt) query = query.eq('updated_at', updatedAt)
  const { data, error } = await query.select('id').maybeSingle()
  if (error) throw error
  if (!data)
    throw new Error(
      'O estoque mudou desde a abertura do formulário. Recarregue o acervo antes de editar novamente.',
    )
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

  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Informe o título do livro desejado.')
  if (
    cleanTitle.length > LIMITS.wishlistTitle ||
    author.trim().length > LIMITS.wishlistAuthor
  )
    throw new Error('O título ou o autor do desejo está longo demais.')

  const { error } = await supabase.from('wishlists').insert({
    user_id: user.id,
    title: cleanTitle,
    author: cleanString(author),
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
