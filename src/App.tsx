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
  AlertTriangle,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  Heart,
  ListFilter,
  Loader2,
  LogIn,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Upload,
  User,
  X,
} from 'lucide-react'
import './App.css'
import {
  createBook,
  createStoreRequest,
  getCurrentSession,
  loadCatalog,
  loadMyStore,
  signIn,
  signOut,
  signUp,
  subscribeToAuth,
} from './lib/catalog'
import { isSupabaseConfigured } from './lib/supabase'
import type { AuthSession } from './lib/supabase'
import type {
  BookCondition,
  BookDraft,
  BookRecord,
  CatalogSource,
  StoreDraft,
  StoreRecord,
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

type CatalogSortMode = 'recent' | 'price-asc' | 'price-desc' | 'title'

function App() {
  const [query, setQuery] = useState('')
  const [books, setBooks] = useState<BookRecord[]>([])
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [source, setSource] = useState<CatalogSource>('demo')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'catalog' | 'stores' | 'owner'>('catalog')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [selectedBook, setSelectedBook] = useState<BookRecord | null>(null)

  const refreshCatalog = useCallback(async (term = query) => {
    setLoading(true)
    const payload = await loadCatalog(term)
    setBooks(payload.books)
    setStores(payload.stores)
    setSource(payload.source)
    setLoadError(payload.error ?? null)
    setLoading(false)
  }, [query])

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

    getCurrentSession().then(setSession)
    const unsubscribe = subscribeToAuth(async () => {
      setSession(await getCurrentSession())
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
    setActiveView('catalog')
  }

  const openStoreCatalog = (storeName: string) => {
    setQuery(storeName)
    refreshCatalog(storeName)
    setActiveView('catalog')
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
            type="button"
            onClick={() => setActiveView('catalog')}
          >
            Catalogo
          </button>
          <button
            className={activeView === 'stores' ? 'nav-button active' : 'nav-button'}
            type="button"
            onClick={() => setActiveView('stores')}
          >
            Sebos
          </button>
          <button
            className={activeView === 'owner' ? 'nav-button active' : 'nav-button'}
            type="button"
            onClick={() => setActiveView('owner')}
          >
            Area do sebo
          </button>
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

        <section className="workspace">
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

          {activeView === 'owner' && (
            <OwnerPanel
              session={session}
              onAuthChange={async () => setSession(await getCurrentSession())}
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

function OwnerPanel({
  session,
  onAuthChange,
  onCatalogChange,
}: {
  session: AuthSession | null
  onAuthChange: () => Promise<void>
  onCatalogChange: () => void
}) {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [store, setStore] = useState<StoreRecord | null>(null)
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
  const [bookDraft, setBookDraft] = useState<BookDraft>({
    title: '',
    author: '',
    isbn: '',
    condition: 'GOOD',
    price: '',
    quantity: '1',
  })

  useEffect(() => {
    let active = true

    if (!session) {
      Promise.resolve().then(() => {
        if (active) setStore(null)
      })
      return () => {
        active = false
      }
    }

    loadMyStore().then((loadedStore) => {
      if (active) setStore(loadedStore)
    })

    return () => {
      active = false
    }
  }, [session])

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      if (authMode === 'signin') {
        await signIn(email, password)
        setMessage('Login realizado.')
      } else {
        await signUp(email, password, displayName)
        setMessage('Conta criada. Confirme o email se o Supabase exigir.')
      }
      await onAuthChange()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel autenticar.')
    } finally {
      setSaving(false)
    }
  }

  const handleStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await createStoreRequest(storeDraft)
      setMessage('Sebo enviado para aprovacao.')
      setStore(await loadMyStore())
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
      await createBook(store?.id ?? '', bookDraft)
      setMessage('Livro cadastrado no acervo.')
      setBookDraft({
        title: '',
        author: '',
        isbn: '',
        condition: 'GOOD',
        price: '',
        quantity: '1',
      })
      onCatalogChange()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel cadastrar o livro.')
    } finally {
      setSaving(false)
    }
  }

  if (!session) {
    return (
      <div className="owner-layout">
        <section className="owner-card">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Area do sebo</p>
              <h2>{authMode === 'signin' ? 'Entrar no painel' : 'Criar conta'}</h2>
            </div>
            <LogIn size={22} />
          </div>
          <div className="segmented">
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
          </div>
          <form className="stack-form" onSubmit={handleAuth}>
            {authMode === 'signup' && (
              <label>
                Nome
                <input
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Responsavel pelo sebo"
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
                placeholder="sebo@email.com"
              />
            </label>
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
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? <Loader2 className="spin" size={18} /> : <User size={18} />}
              {authMode === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
          {message && <p className="form-message">{message}</p>}
        </section>

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

        {store && (
          <form className="stack-form" onSubmit={handleBook}>
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
            <div className="form-row">
              <label>
                ISBN
                <input
                  value={bookDraft.isbn}
                  onChange={(event) => setBookDraft({ ...bookDraft, isbn: event.target.value })}
                />
              </label>
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
            </div>
            <div className="form-row">
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
                  min="1"
                  value={bookDraft.quantity}
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, quantity: event.target.value })
                  }
                />
              </label>
            </div>
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
              Cadastrar livro
            </button>
          </form>
        )}
        {message && <p className="form-message">{message}</p>}
      </section>

      <aside className="owner-note">
        <Upload size={24} />
        <h3>Acervo em evolucao</h3>
        <p>
          A migration ja cria buckets para capas e fotos. Depois da base aprovada,
          o painel pode ganhar upload de imagem e notificacao de wishlist.
        </p>
        <div className="owner-checklist" aria-label="Proximos recursos">
          <span>Capas</span>
          <span>Wishlist</span>
          <span>Reservas</span>
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
