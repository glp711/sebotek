import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Heart,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from 'lucide-react'
import type { BookRecord, StoreRecord } from '../types'
import { filterBooks, type CatalogSort } from '../lib/catalogFilters'
import { BookCover } from './BookCover'

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value,
  )
const conditions = {
  NEW: 'Novo',
  LIKE_NEW: 'Seminovo',
  GOOD: 'Bom',
  FAIR: 'Regular',
  POOR: 'Gasto',
}

export function CatalogBrowser({
  books,
  stores,
  loading,
  query,
  storeId,
  onClearSearch,
  onSelectBook,
  onRefresh,
  onSaveBook,
  savedTitles,
  savingBookId,
}: {
  books: BookRecord[]
  stores: StoreRecord[]
  loading: boolean
  query: string
  storeId: string
  onClearSearch: () => void
  onSelectBook: (book: BookRecord) => void
  onRefresh: () => void
  onSaveBook: (book: BookRecord) => void
  savedTitles: string[]
  savingBookId: string | null
}) {
  const [category, setCategory] = useState('all')
  const [condition, setCondition] = useState('all')
  const [selectedStore, setSelectedStore] = useState(storeId)
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState<CatalogSort>('recent')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          books
            .map((book) => book.category)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [books],
  )
  const visible = useMemo(
    () =>
      filterBooks(books, {
        query,
        category,
        condition,
        storeId: selectedStore,
        maxPrice,
        sort,
      }),
    [books, query, category, condition, selectedStore, maxPrice, sort],
  )
  const filterCount =
    Number(category !== 'all') +
    Number(condition !== 'all') +
    Number(Boolean(selectedStore)) +
    Number(maxPrice !== '')
  const clear = () => {
    setCategory('all')
    setCondition('all')
    setSelectedStore('')
    setMaxPrice('')
    onClearSearch()
  }

  return (
    <div className="catalog-layout">
      <aside
        className={`catalog-sidebar ${filtersOpen ? 'is-open' : ''}`}
        id="catalog-filters"
        aria-label="Filtrar livros"
      >
        <div className="filter-heading">
          <h2>
            <SlidersHorizontal size={17} /> Filtros
          </h2>
          {(filterCount > 0 || query) && (
            <button type="button" className="text-button" onClick={clear}>
              Limpar
            </button>
          )}
        </div>
        <fieldset className="category-options">
          <legend>Categorias</legend>
          {['all', ...categories].map((value) => (
            <label className={category === value ? 'selected' : ''} key={value}>
              <input
                type="radio"
                name="category"
                checked={category === value}
                onChange={() => setCategory(value)}
              />
              <span>{value === 'all' ? 'Todos os livros' : value}</span>
              <small>
                {value === 'all'
                  ? books.length
                  : books.filter((book) => book.category === value).length}
              </small>
            </label>
          ))}
        </fieldset>
        <label className="filter-field">
          Estado de conservação
          <select
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
          >
            <option value="all">Todos os estados</option>
            {Object.entries(conditions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          Sebo
          <select
            value={selectedStore}
            onChange={(event) => setSelectedStore(event.target.value)}
          >
            <option value="">Todos os sebos</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          Preço máximo (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Sem limite"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
          />
        </label>
        <div className="sidebar-note">
          <BookOpen size={20} />
          <p>
            Cada livro tem uma história.
            <br />
            <strong>A próxima pode ser sua.</strong>
          </p>
        </div>
        <button
          type="button"
          className="primary-action mobile-filter-results"
          onClick={() => setFiltersOpen(false)}
        >
          Ver {visible.length} resultados
        </button>
      </aside>
      <div className="catalog-results" aria-busy={loading}>
        <div className="catalog-toolbar">
          <div>
            <h2>{query ? 'Resultados da busca' : 'Explore o acervo'}</h2>
            <p role="status">
              {loading
                ? 'Buscando livros...'
                : `${visible.length} ${visible.length === 1 ? 'livro encontrado' : 'livros encontrados'}`}
            </p>
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="secondary-action mobile-filter"
              aria-expanded={filtersOpen}
              aria-controls="catalog-filters"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={16} /> Filtros
              {filterCount > 0 ? ` (${filterCount})` : ''}
            </button>
            <select
              aria-label="Ordenar livros"
              value={sort}
              onChange={(event) => setSort(event.target.value as CatalogSort)}
            >
              <option value="recent">Mais recentes</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
              <option value="title">Título A–Z</option>
            </select>
            <div className="view-switch" aria-label="Visualização">
              <button
                type="button"
                title="Grade"
                aria-label="Grade"
                aria-pressed={layout === 'grid'}
                onClick={() => setLayout('grid')}
              >
                <LayoutGrid size={17} />
              </button>
              <button
                type="button"
                title="Lista"
                aria-label="Lista"
                aria-pressed={layout === 'list'}
                onClick={() => setLayout('list')}
              >
                <List size={18} />
              </button>
            </div>
            <button
              type="button"
              className="icon-button"
              title="Atualizar catálogo"
              aria-label="Atualizar catálogo"
              disabled={loading}
              onClick={onRefresh}
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
        {(query || filterCount > 0) && (
          <div className="active-filters">
            {query && (
              <button type="button" onClick={onClearSearch}>
                Busca: {query}
                <X size={14} />
              </button>
            )}
            {category !== 'all' && (
              <button type="button" onClick={() => setCategory('all')}>
                {category}
                <X size={14} />
              </button>
            )}
            {condition !== 'all' && (
              <button type="button" onClick={() => setCondition('all')}>
                {conditions[condition as keyof typeof conditions]}
                <X size={14} />
              </button>
            )}
            {selectedStore && (
              <button type="button" onClick={() => setSelectedStore('')}>
                {stores.find((store) => store.id === selectedStore)?.name ??
                  'Sebo selecionado'}
                <X size={14} />
              </button>
            )}
            {maxPrice !== '' && (
              <button type="button" onClick={() => setMaxPrice('')}>
                Até {money(Number(maxPrice))}
                <X size={14} />
              </button>
            )}
          </div>
        )}
        {loading ? (
          <div className="book-grid" aria-label="Carregando catálogo">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="book-skeleton" key={index}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : (
          <div className={`book-grid ${layout === 'list' ? 'list-view' : ''}`}>
            {visible.map((book) => (
              <article className="book-card" key={book.id}>
                <button
                  type="button"
                  className="book-card-main"
                  onClick={() => onSelectBook(book)}
                  aria-label={`Ver detalhes de ${book.title}`}
                >
                  <div className="book-cover">
                    <BookCover book={book} />
                  </div>
                  <div className="book-body">
                    <span className="book-category">
                      {book.category ?? 'Literatura'}
                    </span>
                    <h3>{book.title}</h3>
                    <p className="book-author">{book.author}</p>
                    <span className="condition-tag">
                      <span />
                      {conditions[book.condition]}
                    </span>
                    <strong className="book-price">{money(book.price)}</strong>
                    <span className="store-row">
                      <Store size={13} />
                      {book.store?.name ?? 'Sebo parceiro'}
                    </span>
                    <span className="book-cta">
                      Ver exemplar <ArrowUpRight size={16} />
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`favorite-button ${savedTitles.includes(book.title) ? 'saved' : ''}`}
                  title={
                    savedTitles.includes(book.title)
                      ? 'Salvo nos seus desejos'
                      : 'Salvar nos desejos'
                  }
                  aria-label={`Salvar ${book.title} nos desejos`}
                  disabled={
                    savingBookId !== null || savedTitles.includes(book.title)
                  }
                  onClick={() => onSaveBook(book)}
                >
                  {savedTitles.includes(book.title) ? (
                    <Check size={17} />
                  ) : (
                    <Heart size={17} />
                  )}
                </button>
              </article>
            ))}
          </div>
        )}
        {!loading && !visible.length && (
          <div className="empty-state">
            <Search size={32} />
            <h3>Nenhum livro por aqui ainda</h3>
            <p>Tente outro título, autor ou ajuste os filtros.</p>
            <button type="button" className="secondary-action" onClick={clear}>
              Limpar busca e filtros
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
