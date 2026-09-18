import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
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
  EyeOff,
  ArrowRight,
  LogOut,
  Leaf,
  ListFilter,
  Heart,
  ImageIcon,
  KeyRound,
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
import { CatalogBrowser } from './components/CatalogBrowser'
import { BookCover } from './components/BookCover'
import { normalizeSearch, whatsappUrl } from './lib/catalogFilters'
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
  oauthIntentStorageKey,
  resendSignupCode,
  sendPasswordReset,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  subscribeToAuth,
  updateMyProfile,
  updateBook,
  updatePassword,
  verifySignupCode,
  setStoreApproval,
} from './lib/catalog'
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
    ? whatsappUrl(
        book.store.phone,
        `Oi! Vi no Sebo Virtual o livro "${book.title}" de ${book.author}. Ainda esta disponivel?`,
      )
    : undefined

const getFriendlyAuthError = (error: unknown) => {
  if (!(error instanceof Error)) return 'Nao foi possivel concluir a acao.'

  const message = error.message.toLowerCase()
  if (message.includes('email rate limit') || message.includes('rate limit')) {
    return 'O envio de emails esta temporariamente indisponivel por excesso de solicitacoes. Aguarde antes de tentar novamente. Se sua conta ja foi confirmada, voce pode entrar normalmente.'
  }

  if (message.includes('invalid login credentials')) {
    return 'Email ou senha incorretos.'
  }

  if (message.includes('email not confirmed')) {
    return 'Confirme seu email antes de entrar.'
  }

  if (message.includes('token has expired') || message.includes('otp_expired')) {
    return 'O código expirou. Solicite um novo código e tente novamente.'
  }

  if (message.includes('invalid token') || message.includes('token is invalid')) {
    return 'Código inválido. Confira os seis números recebidos por email.'
  }

  if (
    message.includes('provider is not enabled') ||
    message.includes('unsupported provider')
  ) {
    return 'O login com Google ainda precisa ser ativado no painel do Supabase.'
  }

  return error.message
}

type AppView = 'catalog' | 'stores' | 'client' | 'owner' | 'admin'
type AuthRoute = 'confirm' | 'reset-password' | 'oauth' | null

const viewPaths: Record<AppView, string> = {
  catalog: '/catalogo',
  stores: '/sebos',
  client: '/conta',
  owner: '/meu-sebo',
  admin: '/admin',
}
const viewNames: Record<AppView, string> = {
  catalog: 'Catálogo',
  stores: 'Sebos parceiros',
  client: 'Minha conta',
  owner: 'Meu sebo',
  admin: 'Administração',
}
function currentView(): AppView {
  return (
    (Object.entries(viewPaths).find(
      ([, path]) => path === window.location.pathname,
    )?.[0] as AppView) ?? 'catalog'
  )
}

function App() {
  const [query, setQuery] = useState(
    () => new URLSearchParams(window.location.search).get('q') ?? '',
  )
  const [searchTerm, setSearchTerm] = useState(query)
  const [storeFilter, setStoreFilter] = useState(
    () => new URLSearchParams(window.location.search).get('sebo') ?? '',
  )
  const [books, setBooks] = useState<BookRecord[]>([])
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [source, setSource] = useState<CatalogSource>('demo')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<AppView>(currentView)
  const [pagePath, setPagePath] = useState(window.location.pathname)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [identityLoading, setIdentityLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [selectedBook, setSelectedBook] = useState<BookRecord | null>(null)
  const [savedTitles, setSavedTitles] = useState<string[]>([])
  const [savingBookId, setSavingBookId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const catalogRequest = useRef(0)
  const identityRequest = useRef(0)
  const authRoute = getAuthRoute(pagePath)

  const refreshCatalog = useCallback(async () => {
    const request = ++catalogRequest.current
    setLoading(true)
    try {
      const payload = await loadCatalog('')
      if (request !== catalogRequest.current) return
      setBooks(payload.books)
      setStores(payload.stores)
      setSource(payload.source)
      setLoadError(payload.error ?? null)
    } catch {
      if (request === catalogRequest.current)
        setLoadError('Não foi possível atualizar o acervo. Tente novamente.')
    } finally {
      if (request === catalogRequest.current) setLoading(false)
    }
  }, [])

  const refreshSession = useCallback(async () => {
    const request = ++identityRequest.current
    try {
      const currentSession = await getCurrentSession()
      const [nextProfile, wishlist] = currentSession
        ? await Promise.all([loadMyProfile(), loadMyWishlist()])
        : [null, []]
      if (request !== identityRequest.current) return
      setSession(currentSession)
      setProfile(nextProfile)
      setSavedTitles(wishlist.map((item) => item.title))
    } catch {
      if (request === identityRequest.current)
        setNotice(
          'Não foi possível carregar sua conta. Atualize a página para tentar novamente.',
        )
    } finally {
      if (request === identityRequest.current) setIdentityLoading(false)
    }
  }, [])

  const showView = useCallback((view: AppView, term = '', storeId = '') => {
    const url = new URL(viewPaths[view], window.location.origin)
    if (term) url.searchParams.set('q', term)
    if (storeId) url.searchParams.set('sebo', storeId)
    if (
      url.pathname + url.search !==
      window.location.pathname + window.location.search
    ) {
      window.history.pushState({}, '', url.pathname + url.search)
    }
    setPagePath(url.pathname)
    setActiveView(view)
    setQuery(term)
    setSearchTerm(term)
    setStoreFilter(storeId)
    setSelectedBook(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  const cancelRequests = useCallback(() => {
    catalogRequest.current++
    identityRequest.current++
  }, [])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) {
        void refreshCatalog()
        void refreshSession()
      }
    })
    // Schedule outside the auth callback so Supabase can release its session lock.
    const unsubscribe = subscribeToAuth(() => {
      window.setTimeout(() => {
        if (active) void refreshSession()
      }, 0)
    })
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      setActiveView(currentView())
      setPagePath(window.location.pathname)
      setSearchTerm(params.get('q') ?? '')
      setQuery(params.get('q') ?? '')
      setStoreFilter(params.get('sebo') ?? '')
      setSelectedBook(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      active = false
      cancelRequests()
      unsubscribe()
      window.removeEventListener('popstate', onPopState)
    }
  }, [refreshCatalog, refreshSession, cancelRequests])

  useEffect(() => {
    document.title = `${authRoute ? 'Acesso à conta' : viewNames[activeView]} | Sebo Virtual`
  }, [activeView, authRoute])

  const saveBook = async (book: BookRecord) => {
    if (!session) {
      setNotice('Entre na sua conta para salvar livros na lista de desejos.')
      showView('client')
      return
    }
    if (savingBookId || savedTitles.includes(book.title)) return
    setSavingBookId(book.id)
    try {
      await createWishlistItem(book.title, book.author)
      setSavedTitles((titles) => [...titles, book.title])
      setNotice(`“${book.title}” foi salvo nos seus desejos.`)
    } catch {
      setNotice('Não foi possível salvar o livro. Tente novamente.')
    } finally {
      setSavingBookId(null)
    }
  }

  if (authRoute) {
    return (
      <AuthRoutePage
        route={authRoute}
        session={session}
        loading={identityLoading}
        onAuthChange={refreshSession}
        onBack={() => {
          const intent = getAuthIntentFromUrl()
          window.sessionStorage.removeItem(oauthIntentStorageKey)
          showView(intent === 'store' ? 'owner' : 'client')
        }}
      />
    )
  }

  const navItems: { view: AppView; icon: typeof BookOpen }[] = [
    { view: 'catalog', icon: BookOpen },
    { view: 'stores', icon: Store },
    { view: 'client', icon: User },
    { view: 'owner', icon: Building2 },
    ...(profile?.role === 'ADMIN'
      ? [{ view: 'admin' as AppView, icon: ShieldCheck }]
      : []),
  ]
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Pular para o conteúdo
      </a>
      <div className="announcement">
        <span>
          <Leaf size={14} /> Livros circulam. Histórias continuam.
        </span>
        <span>Sebos independentes, perto de você.</span>
      </div>
      <header className="site-header">
        <div className="topbar">
          <a
            className="brand"
            href="/catalogo"
            onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey) {
                event.preventDefault()
                showView('catalog')
              }
            }}
            aria-label="Sebo Virtual, catálogo"
          >
            <span className="brand-mark">
              <BookOpen size={26} strokeWidth={1.8} />
            </span>
            <span className="brand-name">
              sebo<span>virtual</span>
              <small>ENCONTRE. LEIA. RECOMECE.</small>
            </span>
          </a>
          <form
            className="search-box"
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              showView('catalog', query.trim())
            }}
          >
            <Search size={19} aria-hidden="true" />
            <input
              aria-label="Buscar livros"
              placeholder="Qual livro você está procurando?"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button
                className="search-clear"
                type="button"
                aria-label="Limpar busca"
                title="Limpar busca"
                onClick={() => {
                  setQuery('')
                  showView('catalog')
                }}
              >
                <X size={16} />
              </button>
            )}
            <button type="submit" aria-label="Buscar">
              <ArrowRight size={20} />
            </button>
          </form>
          <a
            className="account-link"
            href="/conta"
            onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey) {
                event.preventDefault()
                showView('client')
              }
            }}
          >
            <User size={21} />
            <span>
              <small>
                {session ? 'Bem-vindo de volta' : 'Seu cantinho de leitura'}
              </small>
              <strong>{profile?.displayName ?? 'Entrar / Cadastrar'}</strong>
            </span>
          </a>
        </div>
        <div className="navigation-bar">
          <nav className="nav-actions" aria-label="Navegação principal">
            {navItems.map(({ view, icon: Icon }) => (
              <a
                key={view}
                href={viewPaths[view]}
                className={
                  activeView === view ? 'nav-button active' : 'nav-button'
                }
                aria-current={activeView === view ? 'page' : undefined}
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault()
                    showView(view)
                  }
                }}
              >
                <Icon size={17} />
                {viewNames[view]}
              </a>
            ))}
          </nav>
          <span className="nav-location">
            <MapPin size={14} /> Rio de Janeiro
          </span>
        </div>
      </header>
      <main>
        {activeView === 'catalog' ? (
          <section className="catalog-intro">
            <div>
              <p className="section-kicker">
                Livros de segunda mão. Descobertas de primeira.
              </p>
              <h1>
                Sebo Virtual<span>Um novo capítulo começa aqui.</span>
              </h1>
              <p>
                Encontre seu próximo livro e converse direto com quem cuida
                dele.
              </p>
            </div>
            <div className="intro-index">
              <span>
                <strong>{loading ? '—' : books.length}</strong> títulos no
                acervo
              </span>
              <span>
                <strong>
                  {loading
                    ? '—'
                    : stores.filter((store) => store.approved).length}
                </strong>{' '}
                sebos verificados
              </span>
            </div>
          </section>
        ) : (
          <section className="page-heading">
            <p className="section-kicker">
              Sebo Virtual / {viewNames[activeView]}
            </p>
            <h1>{viewNames[activeView]}</h1>
            <p>
              {activeView === 'stores'
                ? 'Conheça os sebos e descubra o que cada acervo guarda.'
                : activeView === 'owner'
                  ? 'Seu espaço para cuidar do sebo e dos seus livros.'
                  : activeView === 'admin'
                    ? 'Acompanhe os cadastros e revise os sebos da comunidade.'
                    : 'Suas leituras, seus desejos e sua próxima descoberta.'}
            </p>
          </section>
        )}
        <section className="workspace" id="workspace" tabIndex={-1}>
          {notice && (
            <div className="notice-banner" role="status">
              <CheckCircle2 size={18} />
              <p>{notice}</p>
              <button
                className="icon-button"
                type="button"
                aria-label="Fechar aviso"
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {(activeView === 'catalog' || activeView === 'stores') &&
            (loadError || source === 'demo') &&
            !loading && (
              <div className="status-strip warning" role="status">
                <AlertTriangle size={17} />
                <span>
                  {source === 'demo'
                    ? 'Acervo de demonstração. Os livros e sebos abaixo são exemplos; o acervo online não está disponível agora.'
                    : 'Não foi possível atualizar todos os dados. Tente novamente.'}
                </span>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => void refreshCatalog()}
                >
                  Tentar novamente
                </button>
              </div>
            )}
          {activeView === 'catalog' && (
            <CatalogBrowser
              key={storeFilter}
              books={books}
              stores={stores}
              loading={loading}
              query={searchTerm}
              storeId={storeFilter}
              onClearSearch={() => showView('catalog')}
              onSelectBook={setSelectedBook}
              onRefresh={() => void refreshCatalog()}
              onSaveBook={(book) => void saveBook(book)}
              savedTitles={savedTitles}
              savingBookId={savingBookId}
            />
          )}
          {activeView === 'stores' &&
            (loading ? (
              <div className="empty-state">
                <Loader2 size={24} className="spin" />
                Carregando sebos...
              </div>
            ) : (
              <StoresView
                books={books}
                stores={stores}
                onOpenStoreCatalog={(storeId) =>
                  showView('catalog', '', storeId)
                }
              />
            ))}
          {['client', 'owner', 'admin'].includes(activeView) &&
          identityLoading ? (
            <div className="empty-state" role="status">
              <Loader2 size={24} className="spin" />
              Carregando sua conta...
            </div>
          ) : (
            <>
              {activeView === 'client' && (
                <ClientPanel
                  session={session}
                  onAuthChange={refreshSession}
                  onCatalogSearch={(term) => showView('catalog', term)}
                />
              )}
              {activeView === 'owner' && (
                <OwnerPanel
                  session={session}
                  onAuthChange={refreshSession}
                  onCatalogChange={() => void refreshCatalog()}
                />
              )}
              {activeView === 'admin' && (
                <AdminPanel
                  session={session}
                  profile={profile}
                  onAuthChange={refreshSession}
                  onCatalogChange={() => void refreshCatalog()}
                />
              )}
            </>
          )}
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <BookOpen size={21} />
          <strong>Sebo Virtual</strong>
          <span>Novas histórias para livros que continuam.</span>
        </div>
        <a
          href="https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/vlibras"
          target="_blank"
          rel="noreferrer"
        >
          Acessibilidade com VLibras <ArrowRight size={14} />
        </a>
        <small>Projeto acadêmico · Rio de Janeiro</small>
      </footer>
      {selectedBook && (
        <BookDetailDialog
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onSave={() => void saveBook(selectedBook)}
          saved={savedTitles.includes(selectedBook.title)}
          saving={savingBookId !== null}
          allowContact={source !== 'demo'}
        />
      )}
    </div>
  )
}

function getAuthRoute(path = window.location.pathname): AuthRoute {
  if (typeof window === 'undefined') return null
  if (path === '/auth/confirm') return 'confirm'
  if (path === '/auth/reset-password') return 'reset-password'
  if (path === '/auth/oauth') return 'oauth'
  return null
}

function getAuthIntentFromUrl(): AuthIntent {
  if (typeof window === 'undefined') return 'customer'
  const params = new URLSearchParams(window.location.search)
  const intent =
    params.get('intent') ?? window.sessionStorage.getItem(oauthIntentStorageKey)
  return intent === 'store' ? 'store' : 'customer'
}

function AuthRoutePage({
  route,
  session,
  loading,
  onAuthChange,
  onBack,
}: {
  route: Exclude<AuthRoute, null>
  session: AuthSession | null
  loading: boolean
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
      : (new URLSearchParams(window.location.search).get('error_description') ??
        new URLSearchParams(window.location.hash.replace(/^#/, '')).get(
          'error_description',
        ))

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
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel atualizar a senha.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="auth-page-shell">
      <section className="auth-result-card">
        <span className="brand-mark" aria-hidden="true">
          {route === 'confirm' ? (
            <Mail size={24} />
          ) : route === 'oauth' ? (
            <LogIn size={24} />
          ) : (
            <KeyRound size={24} />
          )}
        </span>

        {route === 'oauth' ? (
          <>
            <p className="section-kicker">Acesso com Google</p>
            <h1>
              {errorMessage
                ? 'Não foi possível entrar com Google'
                : loading
                  ? 'Conectando sua conta'
                  : session
                    ? 'Conta Google conectada'
                    : 'Finalizando seu acesso'}
            </h1>
            <p>
              {errorMessage
                ? 'O Google não concluiu o acesso. Volte e tente novamente ou entre com email e senha.'
                : session
                  ? 'Seu acesso está pronto. Agora você pode continuar no Sebo Virtual.'
                  : 'Aguarde enquanto confirmamos sua sessão com segurança.'}
            </p>
            <div className="dialog-actions">
              <button className="primary-action" type="button" onClick={onBack}>
                {session
                  ? intent === 'store'
                    ? 'Continuar para Meu sebo'
                    : 'Continuar para Minha conta'
                  : 'Voltar para entrar'}
              </button>
              <a className="secondary-action" href="/catalogo">
                Voltar ao catálogo
              </a>
            </div>
          </>
        ) : route === 'confirm' ? (
          <>
            <p className="section-kicker">Confirmacao de email</p>
            <h1>
              {errorMessage
                ? 'Não foi possível confirmar'
                : loading
                  ? 'Verificando seu acesso'
                  : session
                    ? 'Email confirmado'
                    : 'Confirmação de email'}
            </h1>
            <p>
              {errorMessage
                ? 'Este link não pôde ser validado. Ele pode ter expirado ou já ter sido utilizado. Entre na sua conta ou solicite um novo link.'
                : session
                  ? 'Seu acesso está pronto. Continue para sua conta.'
                  : 'Se você já confirmou seu email, entre com email e senha para continuar.'}
            </p>
            <div className="dialog-actions">
              <button className="primary-action" type="button" onClick={onBack}>
                {intent === 'store'
                  ? 'Ir para Meu sebo'
                  : 'Ir para Minha conta'}
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
            <p>
              {loading
                ? 'Verificando seu link...'
                : !session || errorMessage
                  ? 'Abra o link de recuperação enviado ao seu email. Se ele expirou, solicite outro em Minha conta > Recuperar senha.'
                  : 'Escolha uma nova senha para proteger sua conta.'}
            </p>
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
              <button
                className="primary-action"
                disabled={
                  saving || loading || !session || Boolean(errorMessage)
                }
                type="submit"
              >
                {saving ? (
                  <Loader2 className="spin" size={18} />
                ) : (
                  <KeyRound size={18} />
                )}
                Atualizar senha
              </button>
            </form>
            {message && <p className="form-message">{message}</p>}
            <button className="secondary-action" type="button" onClick={onBack}>
              <ArrowLeft size={18} />
              {intent === 'store' ? 'Ir para Meu sebo' : 'Ir para Minha conta'}
            </button>
          </>
        )}
      </section>
    </div>
  )
}

function BookDetailDialog({
  book,
  onClose,
  onSave,
  saved,
  saving,
  allowContact,
}: {
  book: BookRecord
  onClose: () => void
  onSave: () => void
  saved: boolean
  saving: boolean
  allowContact: boolean
}) {
  const whatsapp = allowContact ? getWhatsappUrl(book) : undefined
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input, select, textarea',
      )
      if (!focusable?.length) return
      const first = focusable[0],
        last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKey)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose])

  return (
    <div className="book-dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="book-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="dialog-close"
          type="button"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        <div className="dialog-cover">
          <BookCover book={book} />
        </div>

        <div className="dialog-content">
          <div className="dialog-kicker">
            <BookOpen size={16} />
            {book.category ?? conditionLabel[book.condition] ?? 'Livro usado'}
          </div>
          <h2 id="book-dialog-title">{book.title}</h2>
          <p className="dialog-author">{book.author}</p>
          <p className="dialog-summary">
            {book.summary ??
              'Exemplar disponivel no acervo de um sebo parceiro.'}
          </p>

          <div className="dialog-facts">
            <div>
              <strong>{formatCurrency(book.price)}</strong>
              <span>Preco</span>
            </div>
            <div>
              <strong>
                {conditionLabel[book.condition] ?? book.condition}
              </strong>
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
              <a
                className="primary-action"
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={18} />
                Chamar no WhatsApp
              </a>
            )}
            <button
              className="secondary-action"
              type="button"
              onClick={onSave}
              disabled={saved || saving}
            >
              {saved ? <CheckCircle2 size={17} /> : <Heart size={17} />}
              {saved
                ? 'Salvo nos desejos'
                : saving
                  ? 'Salvando...'
                  : 'Salvar nos desejos'}
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
    const stats = new Map<
      string,
      { books: number; units: number; lowestPrice: number | null }
    >()

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
        current.lowestPrice === null
          ? book.price
          : Math.min(current.lowestPrice, book.price)
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
                <span
                  className={store.approved ? 'approval approved' : 'approval'}
                >
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
                    {stats?.lowestPrice
                      ? formatCurrency(stats.lowestPrice)
                      : '-'}
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
                onClick={() => onOpenStoreCatalog(store.id)}
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
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset'>(
    'signin',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    if (authMode === 'signup' && password !== confirmPassword) {
      setMessage('As senhas não conferem. Confira os dois campos.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      if (authMode === 'signin') {
        await signIn(email, password)
        setMessage('Login realizado.')
        await onAuthChange()
      } else if (authMode === 'signup') {
        await signUp(email, password, displayName, intent)
        setConfirmationEmail(email.trim())
        setConfirmationCode('')
        setMessage(null)
        await onAuthChange()
      } else {
        await sendPasswordReset(email, intent)
        setMessage(
          'Enviamos um link para redefinir sua senha. Verifique seu email.',
        )
      }
    } catch (error) {
      setMessage(getFriendlyAuthError(error))
    } finally {
      setSaving(false)
    }
  }

  const handleCodeConfirmation = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    if (saving || confirmationCode.length !== 6) return
    setSaving(true)
    setMessage(null)
    try {
      await verifySignupCode(confirmationEmail, confirmationCode)
      setMessage('Email confirmado. Sua conta está pronta.')
      await onAuthChange()
    } catch (error) {
      setMessage(getFriendlyAuthError(error))
    } finally {
      setSaving(false)
    }
  }

  const handleCodeResend = async () => {
    if (saving) return
    setSaving(true)
    setMessage(null)
    try {
      await resendSignupCode(confirmationEmail, intent)
      setMessage('Novo código enviado. Confira também a pasta de spam.')
    } catch (error) {
      setMessage(getFriendlyAuthError(error))
    } finally {
      setSaving(false)
    }
  }

  const handleGoogleAuth = async () => {
    if (saving) return
    setSaving(true)
    setMessage(null)
    try {
      await signInWithGoogle(intent)
    } catch (error) {
      setMessage(getFriendlyAuthError(error))
      setSaving(false)
    }
  }

  return (
    <section className="owner-card auth-card">
      <div className="section-heading compact">
        <div>
          <p className="section-kicker">
            {intent === 'store' ? 'Meu sebo' : 'Conta do cliente'}
          </p>
          <h2>{title}</h2>
        </div>
        <LogIn size={22} />
      </div>
      <p className="auth-copy">{description}</p>
      {confirmationEmail ? (
        <div className="confirmation-panel">
          <div className="confirmation-heading">
            <span className="confirmation-icon" aria-hidden="true">
              <Mail size={21} />
            </span>
            <div>
              <p className="section-kicker">Confirme seu email</p>
              <h3>Digite o código recebido</h3>
            </div>
          </div>
          <p>
            Enviamos um código de seis dígitos para{' '}
            <strong>{confirmationEmail}</strong>.
          </p>
          <form className="stack-form" onSubmit={handleCodeConfirmation}>
            <label>
              Código de confirmação
              <input
                className="confirmation-code"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={confirmationCode}
                onChange={(event) =>
                  setConfirmationCode(event.target.value.replace(/\D/g, ''))
                }
                placeholder="000000"
                aria-describedby="confirmation-code-help"
              />
            </label>
            <small id="confirmation-code-help">
              O código expira por segurança. Use sempre o envio mais recente.
            </small>
            <button
              className="primary-action"
              disabled={saving || confirmationCode.length !== 6}
              type="submit"
            >
              {saving ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}
              Confirmar código
            </button>
          </form>
          <div className="confirmation-actions">
            <button
              className="secondary-action"
              disabled={saving}
              type="button"
              onClick={() => void handleCodeResend()}
            >
              <RefreshCw size={17} />
              Reenviar código
            </button>
            <button
              className="text-action"
              disabled={saving}
              type="button"
              onClick={() => {
                setConfirmationEmail('')
                setConfirmationCode('')
                setMessage(null)
              }}
            >
              Corrigir email
            </button>
          </div>
          {message && (
            <p className="form-message" role="status">
              {message}
            </p>
          )}
        </div>
      ) : (
        <>
      <div className="segmented auth-segmented">
        <button
          className={authMode === 'signin' ? 'active' : ''}
          aria-pressed={authMode === 'signin'}
          disabled={saving}
          type="button"
          onClick={() => {
            setAuthMode('signin')
            setMessage(null)
          }}
        >
          Entrar
        </button>
        <button
          className={authMode === 'signup' ? 'active' : ''}
          aria-pressed={authMode === 'signup'}
          disabled={saving}
          type="button"
          onClick={() => {
            setAuthMode('signup')
            setMessage(null)
          }}
        >
          Cadastrar
        </button>
        <button
          className={authMode === 'reset' ? 'active' : ''}
          aria-pressed={authMode === 'reset'}
          disabled={saving}
          type="button"
          onClick={() => {
            setAuthMode('reset')
            setMessage(null)
          }}
        >
          Recuperar senha
        </button>
      </div>
      {authMode !== 'reset' && (
        <>
          <button
            className="google-auth-button"
            disabled={saving}
            type="button"
            onClick={() => void handleGoogleAuth()}
          >
            <span className="google-mark" aria-hidden="true">
              G
            </span>
            {authMode === 'signup'
              ? 'Cadastrar com Google'
              : 'Continuar com Google'}
          </button>
          <div className="auth-divider" aria-hidden="true">
            <span>ou use seu email</span>
          </div>
        </>
      )}
      <form className="stack-form" onSubmit={handleAuth}>
        {authMode === 'signup' && (
          <label>
            Nome
            <input
              required
              value={displayName}
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={
                intent === 'store' ? 'Responsavel pelo sebo' : 'Seu nome'
              }
            />
          </label>
        )}
        <label>
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={
              intent === 'store' ? 'sebo@email.com' : 'cliente@email.com'
            }
          />
        </label>
        {authMode !== 'reset' && (
          <label>
            Senha
            <span className="password-field">
              <input
                required
                minLength={6}
                autoComplete={
                  authMode === 'signin' ? 'current-password' : 'new-password'
                }
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="minimo 6 caracteres"
              />
              <button
                className="icon-button"
                type="button"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
        )}
        {authMode === 'signup' && (
          <label>
            Confirmar senha
            <input
              required
              minLength={6}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Digite a senha novamente"
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
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
        </>
      )}
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
    void Promise.resolve()
      .then(refreshClientData)
      .catch(() =>
        setMessage(
          'Não foi possível carregar seus dados. Atualize a página para tentar novamente.',
        ),
      )
  }, [refreshClientData])

  const handleProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updateMyProfile(displayName)
      await refreshClientData()
      await onAuthChange()
      setMessage('Perfil atualizado.')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel atualizar o perfil.',
      )
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
      await onAuthChange()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel salvar a wishlist.',
      )
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
      await onAuthChange()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel remover o item.',
      )
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
          description="Entre ou crie sua conta para guardar os livros que deseja encontrar."
          onAuthChange={onAuthChange}
        />
        <aside className="owner-note">
          <Heart size={24} />
          <h3>Wishlist do leitor</h3>
          <p>
            O cliente pode salvar livros que ainda nao encontrou e voltar ao
            catalogo quando quiser pesquisar por eles.
          </p>
          <div className="owner-checklist" aria-label="Recursos do cliente">
            <span>Busca salva</span>
            <span>Perfil</span>
            <span>Lista de desejos</span>
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
            <LogOut size={18} />
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
            {saving ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
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
            {saving ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <Heart size={18} />
            )}
            Salvar na wishlist
          </button>
        </form>
        {message && <p className="form-message">{message}</p>}
      </section>

      <aside className="owner-note wishlist-note">
        <Heart size={24} />
        <h3>Livros desejados</h3>
        {wishlist.length === 0 ? (
          <p>
            Nenhum livro salvo ainda. Adicione um titulo para acompanhar depois.
          </p>
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
                    onClick={() =>
                      onCatalogSearch(
                        [item.title, item.author].filter(Boolean).join(' '),
                      )
                    }
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
  const [loadingOwner, setLoadingOwner] = useState(Boolean(session))
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

    Promise.resolve()
      .then(() => {
        if (active) setLoadingOwner(true)
        return loadOwnerArea()
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof Error
              ? error.message
              : 'Nao foi possivel carregar o painel.',
          )
        }
      })
      .finally(() => {
        if (active) setLoadingOwner(false)
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
    const search = normalizeSearch(inventoryQuery)
    if (!search) return myBooks

    return myBooks.filter((book) =>
      normalizeSearch(
        [book.title, book.author, book.isbn, book.category, book.publisher]
          .filter(Boolean)
          .join(' '),
      ).includes(search),
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
    document
      .getElementById('book-editor')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel cadastrar o sebo.',
      )
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
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel cadastrar o livro.',
      )
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
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel remover o livro.',
      )
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
            O responsavel cria conta, envia o cadastro do sebo para aprovacao e
            depois gerencia os livros. A equipe revisa os dados do
            estabelecimento antes de liberar o acervo.
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

  if (loadingOwner)
    return (
      <div className="empty-state" role="status">
        <Loader2 className="spin" size={24} />
        Carregando seu sebo...
      </div>
    )

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
            <LogOut size={18} />
          </button>
        </div>

        <ol className="verification-steps" aria-label="Etapas do cadastro">
          <li className="complete">
            <CheckCircle2 size={18} />
            <span>1. Sua conta</span>
          </li>
          <li
            className={store ? 'complete' : 'current'}
            aria-current={!store ? 'step' : undefined}
          >
            <Store size={18} />
            <span>2. Cadastro do sebo</span>
          </li>
          <li
            className={store?.approved ? 'complete' : store ? 'current' : ''}
            aria-current={store && !store.approved ? 'step' : undefined}
          >
            <ShieldCheck size={18} />
            <span>3. Análise</span>
          </li>
          <li
            className={store?.approved ? 'current' : ''}
            aria-current={store?.approved ? 'step' : undefined}
          >
            <BookOpen size={18} />
            <span>4. Seu acervo</span>
          </li>
        </ol>

        {!store && (
          <form className="stack-form" onSubmit={handleStore}>
            <label>
              Nome do sebo
              <input
                required
                value={storeDraft.name}
                onChange={(event) =>
                  setStoreDraft({ ...storeDraft, name: event.target.value })
                }
              />
            </label>
            <label>
              Descricao
              <textarea
                value={storeDraft.description}
                onChange={(event) =>
                  setStoreDraft({
                    ...storeDraft,
                    description: event.target.value,
                  })
                }
              />
            </label>
            <div className="form-row">
              <label>
                Cidade
                <input
                  required
                  value={storeDraft.city}
                  onChange={(event) =>
                    setStoreDraft({ ...storeDraft, city: event.target.value })
                  }
                />
              </label>
              <label>
                UF
                <input
                  required
                  maxLength={2}
                  value={storeDraft.state}
                  onChange={(event) =>
                    setStoreDraft({ ...storeDraft, state: event.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Endereco
              <input
                required
                value={storeDraft.address}
                onChange={(event) =>
                  setStoreDraft({ ...storeDraft, address: event.target.value })
                }
              />
            </label>
            <div className="form-row">
              <label>
                CEP
                <input
                  value={storeDraft.zipCode}
                  onChange={(event) =>
                    setStoreDraft({
                      ...storeDraft,
                      zipCode: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                WhatsApp
                <input
                  required
                  value={storeDraft.phone}
                  onChange={(event) =>
                    setStoreDraft({ ...storeDraft, phone: event.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Horario
              <input
                value={storeDraft.openingHours}
                onChange={(event) =>
                  setStoreDraft({
                    ...storeDraft,
                    openingHours: event.target.value,
                  })
                }
              />
            </label>
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <ShieldCheck size={18} />
              )}
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
                A administracao precisa verificar o cadastro antes da publicacao
                de livros. Você receberá acesso ao formulário de livros após a
                aprovação. Atualize a página para consultar o status.
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
          <form id="book-editor" className="stack-form" onSubmit={handleBook}>
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
                <p className="section-kicker">
                  {editingBookId ? 'Editar livro' : 'Novo livro'}
                </p>
                <h3>
                  {editingBookId
                    ? 'Atualizar dados do acervo'
                    : 'Cadastrar no acervo'}
                </h3>
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
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, title: event.target.value })
                  }
                />
              </label>
              <label>
                Autor
                <input
                  required
                  value={bookDraft.author}
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, author: event.target.value })
                  }
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                ISBN
                <input
                  value={bookDraft.isbn}
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, isbn: event.target.value })
                  }
                />
              </label>
              <label>
                Categoria
                <input
                  placeholder="Romance, Historia, Fantasia..."
                  list="book-categories"
                  value={bookDraft.category}
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, category: event.target.value })
                  }
                />
                <datalist id="book-categories">
                  {[
                    'Romance',
                    'Romance histórico',
                    'Literatura brasileira',
                    'Fantasia',
                    'Ficção científica',
                    'Mistério',
                    'Infantil',
                    'Poesia',
                    'História',
                    'Biografia',
                    'Didáticos',
                    'Tecnologia',
                  ].map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="form-row">
              <label>
                Editora
                <input
                  value={bookDraft.publisher}
                  onChange={(event) =>
                    setBookDraft({
                      ...bookDraft,
                      publisher: event.target.value,
                    })
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
                    setBookDraft({
                      ...bookDraft,
                      publishedYear: event.target.value,
                    })
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
                onChange={(event) =>
                  setBookDraft({ ...bookDraft, coverUrl: event.target.value })
                }
              />
            </label>
            <label>
              Resumo ou observacoes
              <textarea
                placeholder="Edicao, estado real do exemplar, marcas de uso, sinopse curta..."
                value={bookDraft.summary}
                onChange={(event) =>
                  setBookDraft({ ...bookDraft, summary: event.target.value })
                }
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
                  onChange={(event) =>
                    setBookDraft({ ...bookDraft, price: event.target.value })
                  }
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
              <button
                className="primary-action"
                disabled={saving}
                type="submit"
              >
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
                <button
                  className="secondary-action"
                  type="button"
                  onClick={resetBookForm}
                >
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
            <div
              className="inventory-stats"
              aria-label="Estatisticas do acervo"
            >
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
                      editingBookId === book.id
                        ? 'inventory-item editing'
                        : 'inventory-item'
                    }
                    key={book.id}
                  >
                    <div
                      className="inventory-cover"
                      style={
                        {
                          '--cover-hue': hueFromString(book.title),
                        } as CSSProperties
                      }
                    >
                      {book.coverUrl ? (
                        <img
                          src={book.coverUrl}
                          alt={`Capa de ${book.title}`}
                        />
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
              Depois de enviar o cadastro do sebo, esta area mostra livros
              cadastrados, estoque, capas e atalhos de edicao.
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
  const [statusFilter, setStatusFilter] = useState<
    'pending' | 'approved' | 'all'
  >('pending')
  const [message, setMessage] = useState<string | null>(null)
  const [loadingReview, setLoadingReview] = useState(false)
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null)

  const refreshReviewStores = useCallback(async () => {
    setLoadingReview(true)
    setMessage(null)
    try {
      setReviewStores(await loadAdminStores())
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel carregar os sebos.',
      )
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
    if (statusFilter === 'pending')
      return reviewStores.filter((store) => !store.approved)
    if (statusFilter === 'approved')
      return reviewStores.filter((store) => store.approved)
    return reviewStores
  }, [reviewStores, statusFilter])

  const handleApproval = async (store: StoreRecord, approved: boolean) => {
    setSavingStoreId(store.id)
    setMessage(null)
    try {
      await setStoreApproval(store.id, approved)
      await refreshReviewStores()
      onCatalogChange()
      setMessage(
        approved
          ? 'Sebo aprovado e liberado para cadastrar livros.'
          : 'Sebo voltou para analise.',
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel atualizar o sebo.',
      )
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
            O sebo envia cadastro, a administracao confere os dados e so depois
            libera a criacao de livros no catalogo.
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
        <AlertTriangle size={22} />
        Não foi possível verificar sua permissão.
        <button
          className="secondary-action"
          type="button"
          onClick={() => void onAuthChange()}
        >
          Tentar novamente
        </button>
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
              <LogOut size={18} />
            </button>
          </div>
          <p className="auth-copy">
            Sua conta não tem acesso a esta área. Apenas administradores podem
            aprovar sebos.
          </p>
        </section>

        <aside className="owner-note">
          <AlertTriangle size={24} />
          <h3>Permissao necessaria</h3>
          <p>
            A revisão de sebos está disponível apenas para a equipe responsável
            pelo site.
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
            <button
              className="secondary-action compact-action"
              type="button"
              onClick={refreshReviewStores}
            >
              {loadingReview ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
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
              <LogOut size={18} />
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
                    <span>
                      {new Date(store.createdAt ?? '').toLocaleDateString(
                        'pt-BR',
                      )}
                    </span>
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
        <h3>Antes de aprovar</h3>
        <p>
          Confira nome, endereço e contato antes de aprovar um sebo. Ao retornar
          um sebo para análise, a publicação de novos livros fica bloqueada.
        </p>
        <div className="owner-checklist" aria-label="Protecoes do fluxo">
          <span>Endereço</span>
          <span>Contato</span>
          <span>Aprovacao</span>
        </div>
      </aside>
    </div>
  )
}

function hueFromString(value: string) {
  return String(
    value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360,
  )
}

export default App
