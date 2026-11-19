import test from 'node:test'
import assert from 'node:assert/strict'
import { friendlyErrorMessage } from '../src/lib/friendlyErrors.ts'

test('translates Supabase Auth errors to Portuguese', () => {
  assert.equal(
    friendlyErrorMessage(new Error('Invalid login credentials')),
    'E-mail ou senha incorretos.',
  )
  assert.match(
    friendlyErrorMessage(new Error('Email rate limit exceeded')),
    /temporariamente indisponível/,
  )
  assert.match(friendlyErrorMessage(new Error('Token has expired or is invalid')), /expirou/)
})

test('explains duplicate store owner and duplicate store name separately', () => {
  assert.match(
    friendlyErrorMessage({
      code: '23505',
      message: 'duplicate key value violates unique constraint "stores_owner_id_key"',
    }),
    /já possui um sebo/,
  )
  assert.match(
    friendlyErrorMessage({
      code: '23505',
      message: 'duplicate key value violates unique constraint "stores_slug_key"',
    }),
    /Já existe um sebo com esse nome/,
  )
})

test('translates RLS, check constraint and invalid number errors', () => {
  assert.match(
    friendlyErrorMessage({
      code: '42501',
      message: 'new row violates row-level security policy for table "books"',
    }),
    /não tem permissão/,
  )
  assert.match(
    friendlyErrorMessage({ code: '23514', message: 'violates check constraint "books_isbn_format"' }),
    /valor inválido/,
  )
  assert.match(
    friendlyErrorMessage({ code: '22P02', message: 'invalid input syntax for type numeric' }),
    /formato inválido/,
  )
})

test('translates network failures and timeouts', () => {
  assert.match(friendlyErrorMessage(new TypeError('Failed to fetch')), /Sem conexão/)
  const timeout = new Error('signal timed out')
  timeout.name = 'TimeoutError'
  assert.match(friendlyErrorMessage(timeout), /demorou para responder/)
})

test('keeps unknown messages and uses the fallback for empty errors', () => {
  assert.equal(friendlyErrorMessage(new Error('Mensagem específica')), 'Mensagem específica')
  assert.equal(friendlyErrorMessage(null, 'Falhou.'), 'Falhou.')
  assert.equal(friendlyErrorMessage({}, 'Falhou.'), 'Falhou.')
})
