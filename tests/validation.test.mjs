import test from 'node:test'
import assert from 'node:assert/strict'
import { isSlugConflict, slugify, slugWithSuffix } from '../src/lib/slug.ts'
import { validateBookDraft, validateStoreDraft } from '../src/lib/validation.ts'

const book = {
  title: 'Marina',
  author: 'Carlos Ruiz Zafón',
  isbn: '978-85-01-08097-1',
  category: 'Romance',
  summary: '',
  publisher: 'Suma',
  publishedYear: '2010',
  coverUrl: 'https://exemplo.com/capa.jpg',
  condition: 'GOOD',
  price: '29.90',
  quantity: '2',
}

const store = {
  name: 'Sebo Central',
  description: '',
  address: 'Rua do Ouvidor, 100',
  city: 'Rio de Janeiro',
  state: 'rj',
  zipCode: '20040-030',
  phone: '(21) 99999-0000',
  openingHours: 'Seg a Sex, 9h às 18h',
}

test('slugify removes accents, symbols and never returns an empty slug', () => {
  assert.equal(slugify('Sebo São José & Cia'), 'sebo-sao-jose-cia')
  assert.equal(slugify('  --Livros!!  '), 'livros')
  assert.equal(slugify('###'), 'sebo')
  assert.ok(slugify('a'.repeat(200)).length <= 80)
})

test('slugWithSuffix creates a different, valid slug for repeated names', () => {
  const slug = slugWithSuffix('Sebo Central', () => 0.5)
  assert.match(slug, /^sebo-central-[a-z0-9]{4}$/)
  assert.notEqual(slug, slugify('Sebo Central'))
})

test('isSlugConflict only matches the unique slug violation', () => {
  assert.equal(
    isSlugConflict({ code: '23505', message: 'duplicate key value violates unique constraint "stores_slug_key"' }),
    true,
  )
  assert.equal(
    isSlugConflict({ code: '23505', message: 'duplicate key value violates unique constraint "stores_owner_id_key"' }),
    false,
  )
  assert.equal(isSlugConflict(null), false)
})

test('accepts a complete valid book and a price with comma', () => {
  assert.equal(validateBookDraft(book), null)
  assert.equal(validateBookDraft({ ...book, price: '12,50' }), null)
  assert.equal(validateBookDraft({ ...book, isbn: '', publishedYear: '', coverUrl: '' }), null)
})

test('rejects invalid book values before calling the database', () => {
  assert.match(validateBookDraft({ ...book, title: '   ' }), /título/)
  assert.match(validateBookDraft({ ...book, price: 'abc' }), /preço válido/)
  assert.match(validateBookDraft({ ...book, price: '-1' }), /preço válido/)
  assert.match(validateBookDraft({ ...book, quantity: '1.5' }), /inteiro/)
  assert.match(validateBookDraft({ ...book, publishedYear: '3000' }), /ano entre/)
  assert.match(validateBookDraft({ ...book, isbn: '123' }), /ISBN/)
  assert.match(validateBookDraft({ ...book, coverUrl: 'javascript:alert(1)' }), /http/)
})

test('validates store UF, CEP and WhatsApp phone', () => {
  assert.equal(validateStoreDraft(store), null)
  assert.match(validateStoreDraft({ ...store, state: 'XX' }), /UF válida/)
  assert.match(validateStoreDraft({ ...store, zipCode: '123' }), /CEP/)
  assert.match(validateStoreDraft({ ...store, phone: '9999' }), /telefone/)
  assert.equal(validateStoreDraft({ ...store, zipCode: '' }), null)
})
