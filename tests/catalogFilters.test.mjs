import test from 'node:test'
import assert from 'node:assert/strict'
import {
  filterBooks,
  normalizeSearch,
  whatsappUrl,
} from '../src/lib/catalogFilters.ts'

const books = [
  {
    id: '1',
    title: 'A Sombra do Vento',
    author: 'Carlos Ruiz Zafón',
    category: 'Mistério',
    condition: 'GOOD',
    price: 31,
    storeId: 'a',
    createdAt: '2026-01-01',
    store: { name: 'Sebo A', city: 'São Paulo' },
  },
  {
    id: '2',
    title: 'Marina',
    author: 'Carlos Ruiz Zafón',
    category: 'Romance',
    condition: 'LIKE_NEW',
    price: 25,
    storeId: 'b',
    createdAt: '2026-02-01',
    store: { name: 'Sebo B', city: 'Rio de Janeiro' },
  },
]
const filters = {
  query: '',
  category: 'all',
  condition: 'all',
  storeId: '',
  maxPrice: '',
  sort: 'recent',
}
test('search accepts accents, reordered words and partial words', () => {
  assert.equal(normalizeSearch('  MISTÉRIO '), 'misterio')
  assert.deepEqual(
    filterBooks(books, { ...filters, query: 'zafon marina' }).map((b) => b.id),
    ['2'],
  )
  assert.equal(filterBooks(books, { ...filters, query: 'sao pau' }).length, 1)
})
test('combines filters and treats zero price as an active constraint', () => {
  assert.deepEqual(
    filterBooks(books, {
      ...filters,
      category: 'Romance',
      condition: 'LIKE_NEW',
      storeId: 'b',
      maxPrice: '25',
    }).map((b) => b.id),
    ['2'],
  )
  assert.equal(filterBooks(books, { ...filters, maxPrice: '0' }).length, 0)
  assert.equal(
    filterBooks(books, { ...filters, category: 'Romance', storeId: 'a' })
      .length,
    0,
  )
})
test('sorts without mutating loaded catalog', () => {
  assert.deepEqual(
    filterBooks(books, filters).map((b) => b.id),
    ['2', '1'],
  )
  assert.deepEqual(
    filterBooks(books, { ...filters, sort: 'price-desc' }).map((b) => b.id),
    ['1', '2'],
  )
  assert.deepEqual(
    books.map((b) => b.id),
    ['1', '2'],
  )
})
test('normalizes Brazilian WhatsApp numbers and encodes book names', () => {
  assert.equal(
    whatsappUrl('(21) 99999-1234', 'Olá & livros'),
    'https://wa.me/5521999991234?text=Ol%C3%A1%20%26%20livros',
  )
  assert.equal(
    whatsappUrl('+55 (21) 99999-1234', 'Oi'),
    'https://wa.me/5521999991234?text=Oi',
  )
  assert.equal(whatsappUrl('123', 'Oi'), undefined)
})
