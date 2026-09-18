import type { BookRecord } from '../types'

export type CatalogSort = 'recent' | 'price-asc' | 'price-desc' | 'title'

export const normalizeSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()

export function filterBooks(
  books: BookRecord[],
  filters: {
    query: string
    category: string
    condition: string
    storeId: string
    maxPrice: string
    sort: CatalogSort
  },
) {
  const terms = normalizeSearch(filters.query).split(/\s+/).filter(Boolean)
  const result = books.filter((book) => {
    const searchable = normalizeSearch(
      [
        book.title,
        book.author,
        book.isbn,
        book.category,
        book.publisher,
        book.store?.name,
        book.store?.city,
      ]
        .filter(Boolean)
        .join(' '),
    )
    return (
      terms.every((term) => searchable.includes(term)) &&
      (filters.category === 'all' || book.category === filters.category) &&
      (filters.condition === 'all' || book.condition === filters.condition) &&
      (!filters.storeId || book.storeId === filters.storeId) &&
      (filters.maxPrice === '' || book.price <= Number(filters.maxPrice))
    )
  })
  return result.sort((a, b) => {
    if (filters.sort === 'price-asc') return a.price - b.price
    if (filters.sort === 'price-desc') return b.price - a.price
    if (filters.sort === 'title') return a.title.localeCompare(b.title, 'pt-BR')
    return (
      (Date.parse(b.createdAt ?? '') || 0) -
      (Date.parse(a.createdAt ?? '') || 0)
    )
  })
}

export function whatsappUrl(phone: string, message: string) {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  if (digits.length < 12 || digits.length > 15) return undefined
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
