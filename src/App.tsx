import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  ArrowLeft,
  AlertTriangle,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  Heart,
  ImageIcon,
  KeyRound,
  ListFilter,
  Loader2,
  LogIn,
  MapPin,
  MessageCircle,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react'
import './App.css'
import {
  createBook,
  createStoreRequest,
  createWishlistItem,
  deleteBook,
  deleteWishlistItem,
  getCurrentSession,
  loadCatalog,
  loadAdminStores,
  loadMyBooks,
  loadMyStore,
  loadMyProfile,
  loadMyWishlist,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
  subscribeToAuth,
  updateMyProfile,
  updateBook,
  updatePassword,
  setStoreApproval,
} from './lib/catalog'
import { isSupabaseConfigured } from './lib/supabase'
import type { AuthSession } from './lib/supabase'
import type {
  AuthIntent,
  BookCondition,
  BookDraft,
  BookRecord,
  CatalogSource,
  ProfileRecord,
  StoreDraft,
  StoreRecord,
  WishlistRecord,
} from './types'

const APP_NAME = 'Sebo Virtual'
const APP_REGION = 'Rio de Janeiro'

const conditionLabel: Record<BookCondition, string> = {
  NEW: 'Novo',
  LIKE_NEW: 'Seminovo',
  GOOD: 'Bom',
  FAIR: 'Regular',
  POOR: 'Gasto',
}

const emptyBookDraft: BookDraft = {
  title: '',
  author: '',
  isbn: '',
  category: '',
  summary: '',
  publisher: '',
  publishedYear: '',
  coverUrl: '',
  condition: 'GOOD',
  price: '',
  quantity: '1',
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

const getWhatsappUrl = (book: BookRecord) =>
  book.store?.phone
    ? `https://wa.me/${book.store.phone}?text=${encodeURIComponent(
        `Oi! Vi no ${APP_NAME} que voces tem "${book.title}" de ${book.author}. Ainda esta disponivel?`,
      )}`
    : undefined

const getFriendlyAuthError = (error: unknown) => {
  if (!(error instanceof Error)) return 'Nao foi possivel concluir a acao.'

  const message = error.message.toLowerCase()
  if (message.includes('email rate limit') || message.includes('rate limit')) {
    return 'O Supabase bloqueou novos emails por limite de envio. Aguarde alguns minutos e tente de novo, ou configure SMTP proprio no Supabase para liberar mais envios.'
  }

  if (message.includes('invalid login credentials')) {
    return 'Email ou senha incorretos.'
  }

  if (message.includes('email not confirmed')) {
    return 'Confirme seu email antes de entrar.'
  }

  return error.message
}

type CatalogSortMode = 'recent' | 'price-asc' | 'price-desc' | 'title'
type AppView = 'catalog' | 'stores' | 'client' | 'owner' | 'admin'
type AuthRoute = 'confirm' | 'reset-password' | null

function App() {
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<BookRecord[]>([])
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [source, setSource] = useState<CatalogSource>('demo')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<AppView>('catalog')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [selectedBook, setSelectedBook] = useState<BookRecord | null>(null)
  const authRoute = getAuthRoute()

  const refreshCatalog = useCallback(async (term = query) => {
    setLoading(true)
    const payload = await loadCatalog(term)
    setBooks(payload.books)
    setStores(payload.stores)
    setSource(payload.source)
    setLoadError(payload.error ?? null)
    setLoading(false)
  }, [query])

  const showView = useCallback((view: AppView) => {
    setActiveView(view)
    window.setTimeout(() => {
      document.getElementById('workspace')?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      })
    }, 80)
  }, [])

  useEffect(() => {
    let active = true

    loadCatalog('').then((payload) => {
      if (!active) return
      setBooks(payload.books)
      setStores(payload.stores)
      setSource(payload.source)
      setLoadError(payload.error ?? null)
      setLoading(false)
    })

    async function loadIdentity() {
      const currentSession = await getCurrentSession()
      if (!active) return

      setSession(currentSession)
      setProfile(currentSession ? await loadMyProfile() : null)
    }

    loadIdentity()
    const unsubscribe = subscribeToAuth(async () => {
      const currentSession = await getCurrentSession()
      setSession(currentSession)
      setProfile(currentSession ? await loadMyProfile() : null)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!selectedBook) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedBook(null)
    }

    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedBook])

  const featuredBooks = useMemo(() => books.slice(0, 6), [books])
  const totalInventory = useMemo(
    () => books.reduce((total, book) => total + book.quantity, 0),
    [books],
  )
  const verifiedStores = useMemo(() => stores.filter((store) => store.approved).length, [stores])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    refreshCatalog(query)
    showView('catalog')
  }

  const openStoreCatalog = (storeName: string) => {
    setQuery(storeName)
    refreshCatalog(storeName)
    showView('catalog')
  }

  const refreshSession = useCallback(async () => {
    const currentSession = await getCurrentSession()
    setSession(currentSession)
    setProfile(currentSession ? await loadMyProfile() : null)
  }, [])

  if (authRoute) {
    return (
      <AuthRoutePage
        route={authRoute}
        session={session}
        onAuthChange={refreshSession}
        onBack={() => {
          const intent = getAuthIntentFromUrl()
          window.history.replaceState({}, '', '/')
          showView(intent === 'store' ? 'owner' : 'client')
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label={APP_NAME}>
          <span className="brand-mark" aria-hidden="true">
            <BookOpen size={24} strokeWidth={2.4} />
          </span>
          <span className="brand-name">
            Sebo <span>Virtual</span>
          </span>
        </a>

        <nav className="nav-actions" aria-label="Navegacao principal">
          <button
            className={activeView === 'catalog' ? 'nav-button active' : 'nav-button'}
            aria-pressed={activeView === 'catalog'}
            type="button"
            onClick={() => showView('catalog')}
          >
            Catalogo
          </button>
          <button
            className={activeView === 'stores' ? 'nav-button active' : 'nav-button'}
            aria-pressed={activeView === 'stores'}
            type="button"
            onClick={() => showView('stores')}
          >
            Sebos
          </button>
          <button
            className={activeView === 'client' ? 'nav-button active' : 'nav-button'}
            aria-pressed={activeView === 'client'}
            type="button"
            onClick={() => showView('client')}
          >
            Cliente
          </button>
          <button
            className={activeView === 'owner' ? 'nav-button active' : 'nav-button'}
            aria-pressed={activeView === 'owner'}
            type="button"
            onClick={() => showView('owner')}
          >
            Meu sebo
          </button>
          {profile?.role === 'ADMIN' && (
            <button
              className={activeView === 'admin' ? 'nav-button active' : 'nav-button'}
              aria-pressed={activeView === 'admin'}
              type="button"
              onClick={() => showView('admin')}
            >
              Admin
            </button>
          )}
        </nav>
      </header>

      <main>
        <section className="hero-panel" id="inicio">
          <div className="hero-copy">
            <div className="eyebrow">
              <MapPin size={15} />
              {APP_REGION}
            </div>
            <h1>{APP_NAME} conecta leitores a sebos independentes.</h1>
            <p>
              Encontre livros usados por titulo, autor, categoria ou ISBN e fale direto
              com o sebo que tem o exemplar disponivel.
            </p>
            <form className="search-box" onSubmit={handleSearch}>
              <Search aria-hidden="true" size={22} />
              <input
                aria-label="Buscar livro, autor ou ISBN"
                placeholder="Ex: Marina, romance historico, 978..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit">
                {loading ? <Loader2 className="spin" size={18} /> : <Search size={18} />}
                Buscar
              </button>
            </form>
            <StatusStrip source={source} loadError={loadError} />
          </div>

          <div className="hero-visual" aria-label="Resumo do acervo">
            <div className="stacked-books" aria-hidden="true">
              {featuredBooks.slice(0, 4).map((book, index) => (
                <BookSpine book={book} key={book.id} index={index} />
              ))}
            </div>
            <div className="hero-stats">
              <MetricCard icon={<BookOpen size={18} />} label="Livros" value={books.length} />
              <MetricCard icon={<Store size={18} />} label="Sebos verificados" value={verifiedStores || stores.length} />
              <MetricCard icon={<Heart size={18} />} label="Exemplares" value={totalInventory} />
            </div>
          </div>
        </section>

        <section className="workspace" id="workspace">
          {activeView === 'catalog' && (
            <CatalogView
              books={books}
              loading={loading}
              onSelectBook={setSelectedBook}
              onRefresh={() => refreshCatalog(query)}
            />
          )}

          {activeView === 'stores' && (
            <StoresView books={books} stores={stores} onOpenStoreCatalog={openStoreCatalog} />
          )}

          {activeView === 'client' && (
            <ClientPanel
              session={session}
              onAuthChange={refreshSession}
              onCatalogSearch={(term) => {
                setQuery(term)
                refreshCatalog(term)
                showView('catalog')
              }}
            />
          )}

          {activeView === 'owner' && (
            <OwnerPanel
              session={session}
              onAuthChange={refreshSession}
              onCatalogChange={() => refreshCatalog(query)}
            />
          )}

          {activeView === 'admin' && (
            <AdminPanel
              session={session}
              profile={profile}
              onAuthChange={refreshSession}
              onCatalogChange={() => refreshCatalog(query)}
            />
          )}
        </section>
      </main>

      {selectedBook && (
        <BookDetailDialog book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  )
}

function getAuthRoute(): AuthRoute {
  if (typeof window === 'undefined') return null
  if (window.location.pathname === '/auth/confirm') return 'confirm'
  if (window.location.pathname === '/auth/reset-password') return 'reset-password'
  return null
}

function getAuthIntentFromUrl(): AuthIntent {
  if (typeof window === 'undefined') return 'customer'
  const params = new URLSearchParams(window.location.search)
  return params.get('intent') === 'store' ? 'store' : 'customer'
}

function AuthRoutePage({
  route,
  session,
  onAuthChange,
  onBack,
}: {
  route: Exclude<AuthRoute, null>
  session: AuthSession | null
  onAuthChange: () => Promise<void>
  onBack: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const intent = getAuthIntentFromUrl()
  const errorMessage =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('error_description') ??
        new URLSearchParams(window.location.hash.replace(/^#/, '')).get('error_description')

  useEffect(() => {
    onAuthChange()
  }, [onAuthChange])

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setMessage('As senhas nao conferem.')
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      await updatePassword(password)
      await onAuthChange()
      setMessage('Senha atualizada. Voce ja pode continuar usando sua conta.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar a senha.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="auth-page-shell">
      <section className="auth-result-card">
        <span className="brand-mark" aria-hidden="true">
          {route === 'confirm' ? <Mail size={24} /> : <KeyRound size={24} />}
        </span>

        {route === 'confirm' ? (
          <>
            <p className="section-kicker">Confirmacao de email</p>
            <h1>Email confirmado</h1>
            <p>
              {errorMessage
                ? `O link retornou uma mensagem do Supabase: ${errorMessage}`
                : session
                  ? 'Sua sessao foi reconhecida. Agora voce pode acessar o painel certo para sua conta.'
                  : 'Se o email foi confirmado, entre com seu email e senha para continuar.'}
            </p>
            <div className="dialog-actions">
              <button className="primary-action" type="button" onClick={onBack}>
                {intent === 'store' ? 'Ir para aba Meu sebo' : 'Ir para aba Cliente'}
              </button>
              <a className="secondary-action" href="/">
                Voltar ao catalogo
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="section-kicker">Redefinir senha</p>
            <h1>Crie uma nova senha</h1>
            <p>Digite uma senha nova para concluir o retorno pelo email do Supabase.</p>
            <form className="stack-form" onSubmit={handlePasswordUpdate}>
              <label>
                Nova senha
                <input
                  required
                  minLength={6}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="minimo 6 caracteres"
                />
              </label>
              <label>
                Confirmar senha
                <input
                  required
                  minLength={6}
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="repita a senha"
                />
              </label>
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
                Atualizar senha
              </button>
            </form>
            {message && <p className="form-message">{message}</p>}
            <button className="secondary-action" type="button" onClick={onBack}>
              <ArrowLeft size={18} />
              {intent === 'store' ? 'Ir para aba Meu sebo' : 'Ir para aba Cliente'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}

function StatusStrip({
  source,
  loadError,
}: {
  source: CatalogSource
  loadError: string | null
}) {
  if (!isSupabaseConfigured) {
    return (
      <div className="status-strip warning">
        <AlertTriangle size={16} />
        Modo demonstracao: adicione `.env.local` para conectar no Supabase.
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="status-strip warning">
        <AlertTriangle size={16} />
        Supabase conectado, mas usando dados demo: {loadError}
      </div>
    )
  }

  return (
    <div className="status-strip success">
      <CheckCircle2 size={16} />
      {source === 'legacy'
        ? 'Conectado nas tabelas antigas do Supabase.'
        : 'Conectado na arquitetura Supabase-native.'}
    </div>
  )
}

function CatalogView({
  books,
  loading,
  onSelectBook,
  onRefresh,
}: {
  books: BookRecord[]
  loading: boolean
  onSelectBook: (book: BookRecord) => void
  onRefresh: () => void
}) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [conditionFilter, setConditionFilter] = useState<BookCondition | 'all'>('all')
  const [sortMode, setSortMode] = useState<CatalogSortMode>('recent')

  const categories = useMemo(
    () =>
      Array.from(new Set(books.map((book) => book.category).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [books],
  )

  const visibleBooks = useMemo(() => {
    const nextBooks = books
      .filter((book) => categoryFilter === 'all' || book.category === categoryFilter)
      .filter((book) => conditionFilter === 'all' || book.condition === conditionFilter)

    if (sortMode === 'price-asc') {
      return [...nextBooks].sort((a, b) => a.price - b.price)
    }

    if (sortMode === 'price-desc') {
      return [...nextBooks].sort((a, b) => b.price - a.price)
    }

    if (sortMode === 'title') {
      return [...nextBooks].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    }

    return nextBooks
  }, [books, categoryFilter, conditionFilter, sortMode])

  const storeCount = useMemo(
    () => new Set(visibleBooks.map((book) => book.store?.id ?? book.storeId)).size,
    [visibleBooks],
  )
  const lowestPrice = useMemo(
    () =>
      visibleBooks.length > 0
        ? Math.min(...visibleBooks.map((book) => book.price))
        : 0,
    [visibleBooks],
  )

  const clearFilters = () => {
    setCategoryFilter('all')
    setConditionFilter('all')
    setSortMode('recent')
  }

  return (
    <div className="view-grid">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Catalogo</p>
          <h2>Livros disponiveis</h2>
        </div>
        <div className="section-actions">
          <button
            className="secondary-action compact-action"
            type="button"
            onClick={clearFilters}
          >
            Limpar filtros
          </button>
          <button className="icon-button" type="button" onClick={onRefresh} title="Atualizar catalogo">
            {loading ? <Loader2 className="spin" size={18} /> : <RefreshCw size={18} />}
          </button>
        </div>
      </div>

      <div className="catalog-controls" aria-label="Filtros do catalogo">
        <label>
          <ListFilter size={16} />
          Categoria
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">Todas</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <CheckCircle2 size={16} />
          Estado
          <select
            value={conditionFilter}
            onChange={(event) => setConditionFilter(event.target.value as BookCondition | 'all')}
          >
            <option value="all">Todos</option>
            {Object.entries(conditionLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <RefreshCw size={16} />
          Ordenar
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as CatalogSortMode)}
          >
            <option value="recent">Recentes</option>
            <option value="price-asc">Menor preco</option>
            <option value="price-desc">Maior preco</option>
            <option value="title">Titulo A-Z</option>
          </select>
        </label>
      </div>

      <div className="catalog-summary" aria-label="Resumo dos resultados">
        <span>{visibleBooks.length} livros</span>
        <span>{storeCount} sebos</span>
        <span>A partir de {formatCurrency(lowestPrice)}</span>
      </div>

      <div className="book-grid">
        {visibleBooks.map((book) => (
          <BookCard book={book} key={book.id} onSelect={onSelectBook} />
        ))}
      </div>

      {!loading && visibleBooks.length === 0 && (
        <div className="empty-state">
          <Search size={24} />
          Nenhum livro encontrado para essa busca.
        </div>
      )}
    </div>
  )
}

function BookCard({ book, onSelect }: { book: BookRecord; onSelect: (book: BookRecord) => void }) {
  return (
    <article className="book-card">
      <button
        className="book-card-main"
        type="button"
        onClick={() => onSelect(book)}
        aria-label={`Ver detalhes de ${book.title}`}
      >
        <div
          className={book.coverUrl ? 'book-cover has-image' : 'book-cover'}
          style={{ '--cover-hue': hueFromString(book.title) } as CSSProperties}
        >
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={`Capa do livro ${book.title}`} loading="lazy" />
          ) : (
            <>
              <span>{book.title}</span>
              <small>{book.author}</small>
            </>
          )}
        </div>
        <div className="book-body">
          <div className="book-meta">
            <span>{book.category ?? conditionLabel[book.condition] ?? book.condition}</span>
            <span>{book.quantity} un.</span>
          </div>
          <h3>{book.title}</h3>
          <p>{book.author}</p>
          <p className="book-summary">{book.summary ?? 'Exemplar disponivel para consulta no sebo parceiro.'}</p>
          <div className="price-row">
            <strong>{formatCurrency(book.price)}</strong>
            {book.isbn && <span>ISBN {book.isbn}</span>}
          </div>
          <div className="store-row">
            <Store size={16} />
            <span>{book.store?.name ?? 'Sebo nao informado'}</span>
          </div>
          {book.store && (
            <div className="store-row muted">
              <MapPin size={16} />
              <span>
                {book.store.city}, {book.store.state}
              </span>
            </div>
          )}
          <span className="book-cta">
            <Eye size={17} />
            Detalhes
          </span>
        </div>
      </button>
    </article>
  )
}

function BookDetailDialog({ book, onClose }: { book: BookRecord; onClose: () => void }) {
  const whatsapp = getWhatsappUrl(book)

  return (
    <div className="book-dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="book-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>

        <div
          className={book.coverUrl ? 'dialog-cover has-image' : 'dialog-cover'}
          style={{ '--cover-hue': hueFromString(book.title) } as CSSProperties}
        >
          {book.coverUrl ? (
            <img src={book.coverUrl} alt={`Capa do livro ${book.title}`} />
          ) : (
            <>
              <span>{book.title}</span>
              <small>{book.author}</small>
            </>
          )}
        </div>

        <div className="dialog-content">
          <div className="dialog-kicker">
            <BookOpen size={16} />
            {book.category ?? conditionLabel[book.condition] ?? 'Livro usado'}
          </div>
          <h2 id="book-dialog-title">{book.title}</h2>
          <p className="dialog-author">{book.author}</p>
          <p className="dialog-summary">
            {book.summary ?? 'Exemplar disponivel no acervo de um sebo parceiro.'}
          </p>

          <div className="dialog-facts">
            <div>
              <strong>{formatCurrency(book.price)}</strong>
              <span>Preco</span>
            </div>
            <div>
              <strong>{conditionLabel[book.condition] ?? book.condition}</strong>
              <span>Estado</span>
            </div>
            <div>
              <strong>{book.quantity}</strong>
              <span>Unidades</span>
            </div>
          </div>

          <div className="dialog-meta-grid">
            {book.publisher && (
              <div className="dialog-meta-row">
                <Building2 size={16} />
                <span>{book.publisher}</span>
              </div>
            )}
            {book.publishedYear && (
              <div className="dialog-meta-row">
                <Calendar size={16} />
                <span>{book.publishedYear}</span>
              </div>
            )}
            {book.isbn && (
              <div className="dialog-meta-row">
                <BookOpen size={16} />
                <span>ISBN {book.isbn}</span>
              </div>
            )}
            {book.store && (
              <div className="dialog-meta-row">
                <Store size={16} />
                <span>{book.store.name}</span>
              </div>
            )}
            {book.store && (
              <div className="dialog-meta-row">
                <MapPin size={16} />
                <span>
                  {book.store.address}, {book.store.city} - {book.store.state}
                </span>
              </div>
            )}
          </div>

          <div className="dialog-actions">
            {whatsapp && (
              <a className="primary-action" href={whatsapp} target="_blank" rel="noreferrer">
                <MessageCircle size={18} />
                Chamar no WhatsApp
              </a>
            )}
            <button className="secondary-action" type="button" onClick={onClose}>
              Continuar olhando
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function StoresView({
  books,
  stores,
  onOpenStoreCatalog,
}: {
  books: BookRecord[]
  stores: StoreRecord[]
  onOpenStoreCatalog: (storeName: string) => void
}) {
  const storeStats = useMemo(() => {
    const stats = new Map<string, { books: number; units: number; lowestPrice: number | null }>()

    for (const book of books) {
      if (!book.store?.id) continue
      const current = stats.get(book.store.id) ?? {
        books: 0,
        units: 0,
        lowestPrice: null,
      }

      current.books += 1
      current.units += book.quantity
      current.lowestPrice =
        current.lowestPrice === null ? book.price : Math.min(current.lowestPrice, book.price)
      stats.set(book.store.id, current)
    }

    return stats
  }, [books])

  return (
    <div className="view-grid">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Rede local</p>
          <h2>Sebos parceiros</h2>
        </div>
      </div>

      <div className="store-grid">
        {stores.map((store) => {
          const stats = storeStats.get(store.id)

          return (
            <article className="store-card" key={store.id}>
              <div className="store-card-head">
                <span className="store-avatar">
                  <Store size={24} />
                </span>
                <span className={store.approved ? 'approval approved' : 'approval'}>
                  {store.approved ? 'Verificado' : 'Em analise'}
                </span>
              </div>
              <h3>{store.name}</h3>
              <p>{store.description ?? `Sebo parceiro da rede ${APP_NAME}.`}</p>

              <div className="store-stats">
                <span>
                  <strong>{stats?.books ?? 0}</strong>
                  titulos
                </span>
                <span>
                  <strong>{stats?.units ?? 0}</strong>
                  exemplares
                </span>
                <span>
                  <strong>
                    {stats?.lowestPrice ? formatCurrency(stats.lowestPrice) : '-'}
                  </strong>
                  menor preco
                </span>
              </div>

              <div className="store-detail">
                <MapPin size={16} />
                <span>
                  {store.address}, {store.city} - {store.state}
                </span>
              </div>
              <div className="store-detail">
                <Phone size={16} />
                <span>{store.phone}</span>
              </div>
              {store.openingHours && <small>{store.openingHours}</small>}
              <button
                className="secondary-action store-action"
                type="button"
                onClick={() => onOpenStoreCatalog(store.name)}
              >
                Ver acervo
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function AuthBox({
  intent,
  title,
  description,
  onAuthChange,
}: {
  intent: AuthIntent
  title: string
  description: string
  onAuthChange: () => Promise<void>
}) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      if (authMode === 'signin') {
        await signIn(email, password)
        setMessage('Login realizado.')
        await onAuthChange()
      } else if (authMode === 'signup') {
        await signUp(email, password, displayName, intent)
        setMessage('Conta criada. Confira seu email para confirmar o acesso.')
        await onAuthChange()
      } else {
        await sendPasswordReset(email, intent)
        setMessage('Enviamos um link para redefinir sua senha. Verifique seu email.')
      }
    } catch (error) {
      setMessage(getFriendlyAuthError(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="owner-card auth-card">
      <div className="section-heading compact">
        <div>
          <p className="section-kicker">{intent === 'store' ? 'Meu sebo' : 'Conta do cliente'}</p>
          <h2>{title}</h2>
        </div>
        <LogIn size={22} />
      </div>
      <p className="auth-copy">{description}</p>
      <div className="segmented auth-segmented">
        <button
          className={authMode === 'signin' ? 'active' : ''}
          type="button"
          onClick={() => setAuthMode('signin')}
        >
          Entrar
        </button>
        <button
          className={authMode === 'signup' ? 'active' : ''}
          type="button"
          onClick={() => setAuthMode('signup')}
        >
          Cadastrar
        </button>
        <button
          className={authMode === 'reset' ? 'active' : ''}
          type="button"
          onClick={() => setAuthMode('reset')}
        >
          Senha
        </button>
      </div>
      <form className="stack-form" onSubmit={handleAuth}>
        {authMode === 'signup' && (
          <label>
            Nome
            <input
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={intent === 'store' ? 'Responsavel pelo sebo' : 'Seu nome'}
            />
          </label>
        )}
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={intent === 'store' ? 'sebo@email.com' : 'cliente@email.com'}
          />
        </label>
        {authMode !== 'reset' && (
          <label>
            Senha
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="minimo 6 caracteres"
            />
          </label>
        )}
        <button className="primary-action" disabled={saving} type="submit">
          {saving ? (
            <Loader2 className="spin" size={18} />
          ) : authMode === 'reset' ? (
            <KeyRound size={18} />
          ) : (
            <User size={18} />
          )}
          {authMode === 'signin'
            ? 'Entrar'
            : authMode === 'signup'
              ? 'Criar conta'
              : 'Enviar email'}
        </button>
      </form>
      {message && <p className="form-message">{message}</p>}
    </section>
  )
}

function ClientPanel({
  session,
  onAuthChange,
  onCatalogSearch,
}: {
  session: AuthSession | null
  onAuthChange: () => Promise<void>
  onCatalogSearch: (term: string) => void
}) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [wishlist, setWishlist] = useState<WishlistRecord[]>([])
  const [displayName, setDisplayName] = useState('')
  const [wishlistTitle, setWishlistTitle] = useState('')
  const [wishlistAuthor, setWishlistAuthor] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const refreshClientData = useCallback(async () => {
    if (!session) {
      setProfile(null)
      setWishlist([])
      return
    }

    const [loadedProfile, loadedWishlist] = await Promise.all([
      loadMyProfile(),
      loadMyWishlist(),
    ])
    setProfile(loadedProfile)
    setDisplayName(loadedProfile?.displayName ?? '')
    setWishlist(loadedWishlist)
  }, [session])

  useEffect(() => {
    void Promise.resolve().then(refreshClientData)
  }, [refreshClientData])

  const handleProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updateMyProfile(displayName)
      await refreshClientData()
      setMessage('Perfil atualizado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar o perfil.')
    } finally {
      setSaving(false)
    }
  }

  const handleWishlist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await createWishlistItem(wishlistTitle, wishlistAuthor)
      setWishlistTitle('')
      setWishlistAuthor('')
      await refreshClientData()
      setMessage('Livro salvo na sua wishlist.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar a wishlist.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWishlist = async (id: string) => {
    setSaving(true)
    setMessage(null)
    try {
      await deleteWishlistItem(id)
      await refreshClientData()
      setMessage('Item removido da wishlist.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o item.')
    } finally {
      setSaving(false)
    }
  }

  if (!session) {
    return (
      <div className="owner-layout">
        <AuthBox
          intent="customer"
          title="Entrar como cliente"
          description="Crie sua conta para salvar livros desejados e acompanhar futuras notificacoes de acervo."
          onAuthChange={onAuthChange}
        />
        <aside className="owner-note">
          <Heart size={24} />
          <h3>Wishlist do leitor</h3>
          <p>
            O cliente pode salvar livros que ainda nao encontrou e voltar ao catalogo
            quando quiser pesquisar por eles.
          </p>
          <div className="owner-checklist" aria-label="Recursos do cliente">
            <span>Busca salva</span>
            <span>Perfil</span>
            <span>Futuro alerta</span>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div className="owner-layout">
      <section className="owner-card">
        <div className="section-heading compact">
          <div>
            <p className="section-kicker">Conta do cliente</p>
            <h2>{profile?.displayName ?? session.user.email}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            title="Sair"
            onClick={async () => {
              await signOut()
              await onAuthChange()
            }}
          >
            <User size={18} />
          </button>
        </div>

        <form className="stack-form" onSubmit={handleProfile}>
          <label>
            Nome no perfil
            <input
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <button className="primary-action" disabled={saving} type="submit">
            {saving ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
            Salvar perfil
          </button>
        </form>

        <div className="panel-divider" />

        <form className="stack-form" onSubmit={handleWishlist}>
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Wishlist</p>
              <h3>Salvar livro desejado</h3>
            </div>
          </div>
          <label>
            Titulo
            <input
              required
              value={wishlistTitle}
              onChange={(event) => setWishlistTitle(event.target.value)}
              placeholder="Ex: Ensaio sobre a cegueira"
            />
          </label>
          <label>
            Autor
            <input
              value={wishlistAuthor}
              onChange={(event) => setWishlistAuthor(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <button className="primary-action" disabled={saving} type="submit">
            {saving ? <Loader2 className="spin" size={18} /> : <Heart size={18} />}
            Salvar na wishlist
          </button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </section>

      <aside className="owner-note wishlist-note">
        <Heart size={24} />
        <h3>Livros desejados</h3>
        {wishlist.length === 0 ? (
          <p>Nenhum livro salvo ainda. Adicione um titulo para acompanhar depois.</p>
        ) : (
          <div className="wishlist-list">
            {wishlist.map((item) => (
              <div className="wishlist-item" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  {item.author && <span>{item.author}</span>}
                </div>
                <div className="wishlist-actions">
                  <button
                    className="icon-button"
                    type="button"
                    title="Buscar no catalogo"
                    onClick={() => onCatalogSearch([item.title, item.author].filter(Boolean).join(' '))}
                  >
                    <Search size={16} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title="Remover"
                    onClick={() => handleDeleteWishlist(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}

function OwnerPanel({
  session,
  onAuthChange,
  onCatalogChange,
}: {
  session: AuthSession | null
  onAuthChange: () => Promise<void>
  onCatalogChange: () => void
}) {
  const [store, setStore] = useState<StoreRecord | null>(null)
  const [myBooks, setMyBooks] = useState<BookRecord[]>([])
  const [editingBookId, setEditingBookId] = useState<string | null>(null)
  const [inventoryQuery, setInventoryQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [storeDraft, setStoreDraft] = useState<StoreDraft>({
    name: '',
    description: '',
    address: '',
    city: 'Rio de Janeiro',
    state: 'RJ',
    zipCode: '',
    phone: '',
    openingHours: '',
  })
  const [bookDraft, setBookDraft] = useState<BookDraft>(emptyBookDraft)

  const refreshOwnerBooks = useCallback(async (storeId: string) => {
    const loadedBooks = await loadMyBooks(storeId)
    setMyBooks(loadedBooks)
  }, [])

  useEffect(() => {
    let active = true

    if (!session) {
      Promise.resolve().then(() => {
        if (active) {
          setStore(null)
          setMyBooks([])
          setEditingBookId(null)
          setBookDraft(emptyBookDraft)
        }
      })
      return () => {
        active = false
      }
    }

    async function loadOwnerArea() {
      const loadedStore = await loadMyStore()
      if (!active) return

      setStore(loadedStore)
      if (loadedStore) {
        const loadedBooks = await loadMyBooks(loadedStore.id)
        if (active) setMyBooks(loadedBooks)
      } else {
        setMyBooks([])
      }
    }

    loadOwnerArea().catch((error) => {
      if (active) {
        setMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar o painel.')
      }
    })

    return () => {
      active = false
    }
  }, [session])

  const inventoryStats = useMemo(() => {
    const totalCopies = myBooks.reduce((sum, book) => sum + book.quantity, 0)
    const outOfStock = myBooks.filter((book) => book.quantity <= 0).length
    const withCover = myBooks.filter((book) => book.coverUrl).length

    return {
      totalTitles: myBooks.length,
      totalCopies,
      outOfStock,
      withCover,
    }
  }, [myBooks])

  const visibleOwnerBooks = useMemo(() => {
    const search = inventoryQuery.trim().toLowerCase()
    if (!search) return myBooks

    return myBooks.filter((book) =>
      [book.title, book.author, book.isbn, book.category, book.publisher]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search),
    )
  }, [inventoryQuery, myBooks])

  const resetBookForm = () => {
    setEditingBookId(null)
    setBookDraft(emptyBookDraft)
  }

  const startEditingBook = (book: BookRecord) => {
    setEditingBookId(book.id)
    setBookDraft({
      title: book.title,
      author: book.author,
      isbn: book.isbn ?? '',
      category: book.category ?? '',
      summary: book.summary ?? '',
      publisher: book.publisher ?? '',
      publishedYear: book.publishedYear ? String(book.publishedYear) : '',
      coverUrl: book.coverUrl ?? '',
      condition: book.condition,
      price: String(book.price),
      quantity: String(book.quantity),
    })
    setMessage(`Editando "${book.title}".`)
  }

  const handleStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await createStoreRequest(storeDraft)
      setMessage('Sebo enviado para aprovacao.')
      const loadedStore = await loadMyStore()
      setStore(loadedStore)
      if (loadedStore) await refreshOwnerBooks(loadedStore.id)
      onCatalogChange()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o sebo.')
    } finally {
      setSaving(false)
    }
  }

  const handleBook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      if (editingBookId) {
        await updateBook(editingBookId, bookDraft)
        setMessage('Livro atualizado no acervo.')
      } else {
        await createBook(store?.id ?? '', bookDraft)
        setMessage('Livro cadastrado no acervo.')
      }
      resetBookForm()
      if (store) await refreshOwnerBooks(store.id)
      onCatalogChange()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o livro.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBook = async (book: BookRecord) => {
    const confirmed = window.confirm(`Remover "${book.title}" do acervo?`)
    if (!confirmed) return

    setSaving(true)
    setMessage(null)
    try {
      await deleteBook(book.id)
      if (editingBookId === book.id) resetBookForm()
      if (store) await refreshOwnerBooks(store.id)
      setMessage('Livro removido do acervo.')
      onCatalogChange()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o livro.')
    } finally {
      setSaving(false)
    }
  }

  if (!session) {
    return (
      <div className="owner-layout">
        <AuthBox
          intent="store"
          title="Entrar no painel"
          description="Acesse sua conta para cadastrar o sebo, enviar o perfil para aprovacao e publicar livros no acervo."
          onAuthChange={onAuthChange}
        />

        <aside className="owner-note">
          <ShieldCheck size={24} />
          <h3>Cadastro com aprovacao</h3>
          <p>
            O responsavel cria conta, envia o cadastro do sebo para aprovacao e depois
            gerencia os livros. A aprovacao evita golpes e sustenta o selo de verificado.
          </p>
          <div className="owner-checklist" aria-label="Etapas do sebo">
            <span>Conta</span>
            <span>Sebo aprovado</span>
            <span>Acervo publicado</span>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div className="owner-layout">
      <section className="owner-card">
        <div className="section-heading compact">
          <div>
            <p className="section-kicker">Sebo parceiro</p>
            <h2>{store ? store.name : 'Cadastrar sebo'}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            title="Sair"
            onClick={async () => {
              await signOut()
              await onAuthChange()
            }}
          >
            <User size={18} />
          </button>
        </div>

        {!store && (
          <form className="stack-form" onSubmit={handleStore}>
            <label>
              Nome do sebo
              <input
                required
                value={storeDraft.name}
                onChange={(event) => setStoreDraft({ ...storeDraft, name: event.target.value })}
              />
            </label>
            <label>
              Descricao
              <textarea
                value={storeDraft.description}
                onChange={(event) =>
                  setStoreDraft({ ...storeDraft, description: event.target.value })
                }
              />
            </label>
            <div className="form-row">
              <label>
                Cidade
                <input
                  required
                  value={storeDraft.city}
                  onChange={(event) => setStoreDraft({ ...storeDraft, city: event.target.value })}
                />
              </label>
              <label>
                UF
                <input
                  required
                  maxLength={2}
                  value={storeDraft.state}
                  onChange={(event) => setStoreDraft({ ...storeDraft, state: event.target.value })}
                />
              </label>
            </div>
            <label>
              Endereco
              <input
                required
                value={storeDraft.address}
                onChange={(event) => setStoreDraft({ ...storeDraft, address: event.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                CEP
                <input
                  value={storeDraft.zipCode}
                  onChange={(event) =>
                    setStoreDraft({ ...storeDraft, zipCode: event.target.value })
                  }
                />
              </label>
              <label>
                WhatsApp
                <input
                  required
                  value={storeDraft.phone}
                  onChange={(event) => setStoreDraft({ ...storeDraft, phone: event.target.value })}
                />
              </label>
            </div>
            <label>
              Horario
              <input
                value={storeDraft.openingHours}
                onChange={(event) =>
                  setStoreDraft({ ...storeDraft, openingHours: event.target.value })
                }
              />
            </label>
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? <Loader2 className="spin" size={18} /> : <ShieldCheck size={18} />}
              Enviar para aprovacao
            </button>
          </form>
        )}

        {store && !store.approved && (
          <div className="verification-card">
            <ShieldCheck size={28} />
            <div>
              <p className="section-kicker">Analise obrigatoria</p>
              <h3>Sebo aguardando aprovacao</h3>
              <p>
                A administracao precisa verificar o cadastro antes da publicacao de livros.
                Enquanto isso, revise endereco, telefone e horario para evitar reprova.
              </p>
            </div>
            <div className="owner-checklist" aria-label="Fluxo de verificacao">
              <span>Cadastro enviado</span>
              <span>Analise admin</span>
              <span>Acervo liberado</span>
            </div>
          </div>
        )}

        {store && store.approved && (
          <form className="stack-form" onSubmit={handleBook}>
            <div className="store-status-strip" aria-label="Resumo do sebo">
              <span className={store.approved ? 'approved' : ''}>
                {store.approved ? 'Aprovado' : 'Aguardando aprovacao'}
              </span>
              <span>
                {store.city}, {store.state}
              </span>
              <span>{inventoryStats.totalTitles} titulos</span>
            </div>

            <div className="section-heading mini">
              <div>
                <p className="section-kicker">{editingBookId ? 'Editar livro' : 'Novo livro'}</p>
                <h3>{editingBookId ? 'Atualizar dados do acervo' : 'Cadastrar no acervo'}</h3>
              </div>
              {editingBookId && (
                <button
                  className="secondary-action compact-action"
                  type="button"
                  onClick={resetBookForm}
                >
                  <RefreshCw size={16} />
                  Limpar
                </button>
              )}
            </div>

            <div className="form-row">
              <label>
                Titulo
                <input
                  required
                  value={bookDraft.title}
                  onChange={(event) => setBookDraft({ ...bookDraft, title: event.target.value })}
                />
              </label>
              <label>
                Autor
                <input
                  required
                  value={bookDraft.author}
                  onChange={(event) => setBookDraft({ ...bookDraft, author: event.target.value })}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                ISBN
                <input
                  value={bookDraft.isbn}
                  onChange={(event) => setBookDraft({ ...bookDraft, isbn: event.target.value })}
                />
              </label>
              <label>
                Categoria
                <input
                  placeholder="Romance, Historia, Fantasia..."
                  value={bookDraft.category}
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, category: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Editora
                <input
                  value={bookDraft.publisher}
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, publisher: event.target.value })
                  }
                />
              </label>
              <label>
                Ano
                <input
                  type="number"
                  min="1400"
                  max="2100"
                  value={bookDraft.publishedYear}
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, publishedYear: event.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Link da capa
              <input
                type="url"
                placeholder="https://..."
                value={bookDraft.coverUrl}
                onChange={(event) => setBookDraft({ ...bookDraft, coverUrl: event.target.value })}
              />
            </label>
            <label>
              Resumo ou observacoes
              <textarea
                placeholder="Edicao, estado real do exemplar, marcas de uso, sinopse curta..."
                value={bookDraft.summary}
                onChange={(event) => setBookDraft({ ...bookDraft, summary: event.target.value })}
              />
            </label>
            <div className="form-row three">
              <label>
                Estado
                <select
                  value={bookDraft.condition}
                  onChange={(event) =>
                    setBookDraft({
                      ...bookDraft,
                      condition: event.target.value as BookCondition,
                    })
                  }
                >
                  {Object.entries(conditionLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preco
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={bookDraft.price}
                  onChange={(event) => setBookDraft({ ...bookDraft, price: event.target.value })}
                />
              </label>
              <label>
                Quantidade
                <input
                  required
                  type="number"
                  min="0"
                  value={bookDraft.quantity}
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, quantity: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? (
                  <Loader2 className="spin" size={18} />
                ) : editingBookId ? (
                  <Save size={18} />
                ) : (
                  <Plus size={18} />
                )}
                {editingBookId ? 'Salvar alteracoes' : 'Cadastrar livro'}
              </button>
              {editingBookId && (
                <button className="secondary-action" type="button" onClick={resetBookForm}>
                  <RefreshCw size={18} />
                  Cancelar edicao
                </button>
              )}
            </div>
          </form>
        )}
        {message && <p className="form-message">{message}</p>}
      </section>

      <aside className="owner-note inventory-panel">
        <div className="inventory-header">
          <Upload size={24} />
          <div>
            <h3>Meu acervo</h3>
            <p>
              {store?.approved
                ? 'Controle o que aparece no catalogo e ajuste estoque sem sair do site.'
                : 'O acervo sera liberado depois que a administracao aprovar o sebo.'}
            </p>
          </div>
        </div>

        {store ? (
          <>
            <div className="inventory-stats" aria-label="Estatisticas do acervo">
              <span>
                <BookOpen size={16} />
                <strong>{inventoryStats.totalTitles}</strong>
                Titulos
              </span>
              <span>
                <ListFilter size={16} />
                <strong>{inventoryStats.totalCopies}</strong>
                Exemplares
              </span>
              <span>
                <AlertTriangle size={16} />
                <strong>{inventoryStats.outOfStock}</strong>
                Sem estoque
              </span>
              <span>
                <ImageIcon size={16} />
                <strong>{inventoryStats.withCover}</strong>
                Com capa
              </span>
            </div>

            <label className="inventory-search">
              <Search size={16} />
              <input
                placeholder="Buscar no meu acervo"
                value={inventoryQuery}
                onChange={(event) => setInventoryQuery(event.target.value)}
              />
            </label>

            {visibleOwnerBooks.length === 0 ? (
              <div className="inventory-empty">
                <BookOpen size={22} />
                <span>
                  {myBooks.length === 0
                    ? 'Cadastre o primeiro livro para preencher o catalogo.'
                    : 'Nenhum livro encontrado nessa busca.'}
                </span>
              </div>
            ) : (
              <div className="inventory-list">
                {visibleOwnerBooks.map((book) => (
                  <article
                    className={
                      editingBookId === book.id ? 'inventory-item editing' : 'inventory-item'
                    }
                    key={book.id}
                  >
                    <div
                      className="inventory-cover"
                      style={{ '--cover-hue': hueFromString(book.title) } as CSSProperties}
                    >
                      {book.coverUrl ? (
                        <img src={book.coverUrl} alt={`Capa de ${book.title}`} />
                      ) : (
                        <span>{book.title.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="inventory-body">
                      <strong>{book.title}</strong>
                      <span>{book.author}</span>
                      <small>
                        {formatCurrency(book.price)} / {book.quantity} un. /{' '}
                        {conditionLabel[book.condition]}
                      </small>
                    </div>
                    <div className="inventory-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title="Editar livro"
                        onClick={() => startEditingBook(book)}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        title="Remover livro"
                        disabled={saving}
                        onClick={() => handleDeleteBook(book)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p>
              Depois de enviar o cadastro do sebo, esta area mostra livros cadastrados,
              estoque, capas e atalhos de edicao.
            </p>
            <div className="owner-checklist" aria-label="Funcoes do acervo">
              <span>Criar livros</span>
              <span>Editar dados</span>
              <span>Remover itens</span>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

function AdminPanel({
  session,
  profile,
  onAuthChange,
  onCatalogChange,
}: {
  session: AuthSession | null
  profile: ProfileRecord | null
  onAuthChange: () => Promise<void>
  onCatalogChange: () => void
}) {
  const [reviewStores, setReviewStores] = useState<StoreRecord[]>([])
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'all'>('pending')
  const [message, setMessage] = useState<string | null>(null)
  const [loadingReview, setLoadingReview] = useState(false)
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null)

  const refreshReviewStores = useCallback(async () => {
    setLoadingReview(true)
    setMessage(null)
    try {
      setReviewStores(await loadAdminStores())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar os sebos.')
    } finally {
      setLoadingReview(false)
    }
  }, [])

  useEffect(() => {
    if (!session || profile?.role !== 'ADMIN') {
      return
    }

    Promise.resolve().then(refreshReviewStores)
  }, [profile?.role, refreshReviewStores, session])

  const reviewStats = useMemo(() => {
    const pending = reviewStores.filter((store) => !store.approved).length
    const approved = reviewStores.filter((store) => store.approved).length

    return {
      pending,
      approved,
      total: reviewStores.length,
    }
  }, [reviewStores])

  const visibleReviewStores = useMemo(() => {
    if (statusFilter === 'pending') return reviewStores.filter((store) => !store.approved)
    if (statusFilter === 'approved') return reviewStores.filter((store) => store.approved)
    return reviewStores
  }, [reviewStores, statusFilter])

  const handleApproval = async (store: StoreRecord, approved: boolean) => {
    setSavingStoreId(store.id)
    setMessage(null)
    try {
      await setStoreApproval(store.id, approved)
      await refreshReviewStores()
      onCatalogChange()
      setMessage(approved ? 'Sebo aprovado e liberado para cadastrar livros.' : 'Sebo voltou para analise.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel atualizar o sebo.')
    } finally {
      setSavingStoreId(null)
    }
  }

  if (!session) {
    return (
      <div className="owner-layout">
        <AuthBox
          intent="customer"
          title="Entrar como administrador"
          description="Acesse uma conta com permissao ADMIN para revisar cadastros de sebos antes da publicacao do acervo."
          onAuthChange={onAuthChange}
        />

        <aside className="owner-note">
          <ShieldCheck size={24} />
          <h3>Fluxo de verificacao</h3>
          <p>
            O sebo envia cadastro, a administracao confere os dados e so depois libera
            a criacao de livros no catalogo.
          </p>
          <div className="owner-checklist" aria-label="Etapas da analise">
            <span>Pendente</span>
            <span>Aprovado</span>
            <span>Acervo liberado</span>
          </div>
        </aside>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="empty-state">
        <Loader2 className="spin" size={22} />
        Carregando permissao...
      </div>
    )
  }

  if (profile.role !== 'ADMIN') {
    return (
      <div className="owner-layout">
        <section className="owner-card">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Acesso restrito</p>
              <h2>Painel administrativo</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              title="Sair"
              onClick={async () => {
                await signOut()
                await onAuthChange()
              }}
            >
              <User size={18} />
            </button>
          </div>
          <p className="auth-copy">
            Sua conta esta autenticada, mas nao possui a permissao `ADMIN`. Apenas
            administradores podem aprovar sebos.
          </p>
        </section>

        <aside className="owner-note">
          <AlertTriangle size={24} />
          <h3>Permissao necessaria</h3>
          <p>
            Para liberar este painel, atualize o perfil da conta no Supabase para role
            `ADMIN`.
          </p>
        </aside>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <section className="owner-card admin-review-card">
        <div className="section-heading compact">
          <div>
            <p className="section-kicker">Administracao</p>
            <h2>Analise de sebos</h2>
          </div>
          <div className="section-actions">
            <button className="secondary-action compact-action" type="button" onClick={refreshReviewStores}>
              {loadingReview ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
              Atualizar
            </button>
            <button
              className="icon-button"
              type="button"
              title="Sair"
              onClick={async () => {
                await signOut()
                await onAuthChange()
              }}
            >
              <User size={18} />
            </button>
          </div>
        </div>

        <div className="admin-stats" aria-label="Resumo administrativo">
          <span>
            <AlertTriangle size={16} />
            <strong>{reviewStats.pending}</strong>
            Pendentes
          </span>
          <span>
            <CheckCircle2 size={16} />
            <strong>{reviewStats.approved}</strong>
            Aprovados
          </span>
          <span>
            <Store size={16} />
            <strong>{reviewStats.total}</strong>
            Total
          </span>
        </div>

        <div className="segmented admin-filter" aria-label="Filtro de sebos">
          <button
            className={statusFilter === 'pending' ? 'active' : ''}
            type="button"
            onClick={() => setStatusFilter('pending')}
          >
            Pendentes
          </button>
          <button
            className={statusFilter === 'approved' ? 'active' : ''}
            type="button"
            onClick={() => setStatusFilter('approved')}
          >
            Aprovados
          </button>
          <button
            className={statusFilter === 'all' ? 'active' : ''}
            type="button"
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </button>
        </div>

        {visibleReviewStores.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={22} />
            Nenhum sebo neste filtro.
          </div>
        ) : (
          <div className="admin-store-list">
            {visibleReviewStores.map((store) => (
              <article className="admin-store-item" key={store.id}>
                <div className="admin-store-main">
                  <div className="store-status-strip">
                    <span className={store.approved ? 'approved' : ''}>
                      {store.approved ? 'Aprovado' : 'Pendente'}
                    </span>
                    <span>{new Date(store.createdAt ?? '').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <h3>{store.name}</h3>
                  {store.description && <p>{store.description}</p>}
                  <div className="admin-store-meta">
                    <span>
                      <MapPin size={15} />
                      {store.address}, {store.city} - {store.state}
                    </span>
                    <span>
                      <Phone size={15} />
                      {store.phone}
                    </span>
                    {store.openingHours && (
                      <span>
                        <Calendar size={15} />
                        {store.openingHours}
                      </span>
                    )}
                  </div>
                </div>
                <div className="admin-store-actions">
                  {!store.approved ? (
                    <button
                      className="primary-action"
                      disabled={savingStoreId === store.id}
                      type="button"
                      onClick={() => handleApproval(store, true)}
                    >
                      {savingStoreId === store.id ? (
                        <Loader2 className="spin" size={18} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      Aprovar
                    </button>
                  ) : (
                    <button
                      className="secondary-action"
                      disabled={savingStoreId === store.id}
                      type="button"
                      onClick={() => handleApproval(store, false)}
                    >
                      {savingStoreId === store.id ? (
                        <Loader2 className="spin" size={18} />
                      ) : (
                        <X size={18} />
                      )}
                      Voltar para analise
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {message && <p className="form-message">{message}</p>}
      </section>

      <aside className="owner-note admin-note">
        <ShieldCheck size={24} />
        <h3>Regra do fluxo</h3>
        <p>
          O cadastro do sebo nasce pendente. O lojista so ve o formulario de livros
          depois da aprovacao, e o banco tambem bloqueia criacao de livros antes disso.
        </p>
        <div className="owner-checklist" aria-label="Protecoes do fluxo">
          <span>RLS</span>
          <span>ADMIN</span>
          <span>Aprovacao</span>
        </div>
      </aside>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number | string
}) {
  return (
    <div className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function BookSpine({ book, index }: { book: BookRecord; index: number }) {
  return (
    <div className={`book-spine spine-${index + 1}`}>
      <span>{book.title}</span>
      <small>{book.author}</small>
    </div>
  )
}

function hueFromString(value: string) {
  return String(
    value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360,
  )
}

export default App
