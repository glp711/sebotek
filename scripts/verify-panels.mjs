import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.QA_URL ?? 'http://127.0.0.1:5174'
const output = path.join(tmpdir(), 'sebo-virtual-qa')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const userId = '11111111-1111-4111-8111-111111111111'
const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'qa@example.invalid',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-01-01T00:00:00Z',
}
let role = 'STORE_OWNER'
const store = {
  id: '22222222-2222-4222-8222-222222222222',
  owner_id: userId,
  name: 'Sebo de teste',
  slug: 'sebo-teste',
  description: 'Acervo de teste',
  address: 'Rua de Teste, 10',
  city: 'Rio de Janeiro',
  state: 'RJ',
  phone: '5521999990000',
  approved: false,
  created_at: '2026-09-01T12:00:00Z',
}
const books = []
const wishes = []
const writes = []
const context = await browser.newContext({
  viewport: { width: 1365, height: 960 },
})
await context.addInitScript(
  ({ user }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600
    const token =
      btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) +
      '.' +
      btoa(
        JSON.stringify({ sub: user.id, exp: expires, role: 'authenticated' }),
      ) +
      '.test'
    localStorage.setItem(
      'sb-foaiugorywlkvxevogpi-auth-token',
      JSON.stringify({
        access_token: token,
        refresh_token: 'test-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: expires,
        user,
      }),
    )
  },
  { user },
)
// Intercept every backend request: these tests never write production data.
await context.route(
  'https://foaiugorywlkvxevogpi.supabase.co/**',
  async (route) => {
    const request = route.request(),
      url = new URL(request.url())
    if (url.pathname.includes('/auth/v1/')) {
      return route.fulfill({
        json: url.pathname.endsWith('/user') ? user : { user },
      })
    }
    const table = url.pathname.split('/').at(-1)
    const payload = request.postDataJSON()
    const method = request.method()
    if (method !== 'GET') {
      writes.push({ table, method })
      if (table === 'stores' && method === 'PATCH')
        Object.assign(store, payload)
      if (table === 'books' && method === 'POST')
        books.push({ id: 'book-test', ...payload, stores: { ...store } })
      if (table === 'books' && method === 'PATCH')
        Object.assign(books[0], payload)
      if (table === 'books' && method === 'DELETE') books.splice(0)
      if (table === 'wishlists' && method === 'POST')
        wishes.push({ id: 'wish-test', ...payload, notified: false })
      return route.fulfill({ status: 204 })
    }
    let data = []
    if (table === 'profiles')
      data = [{ id: userId, display_name: 'Pessoa de teste', role }]
    if (table === 'stores')
      data =
        url.searchParams.get('approved') === 'eq.true' && !store.approved
          ? []
          : [{ ...store }]
    if (table === 'books')
      data =
        url.searchParams.get('stores.approved') && !store.approved
          ? []
          : books.map((book) => ({ ...book, stores: { ...store } }))
    if (table === 'wishlists') data = wishes
    return route.fulfill({ json: data })
  },
)
const page = await context.newPage()
page.setDefaultTimeout(15000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
try {
  await page.goto(base + '/meu-sebo', { waitUntil: 'domcontentloaded' })
  await page
    .getByRole('heading', { name: 'Sebo aguardando aprovacao' })
    .waitFor()
  assert.equal(await page.locator('#book-editor').count(), 0)
  await page.screenshot({
    path: path.join(output, 'store-pending.png'),
    fullPage: true,
  })
  role = 'ADMIN'
  await page.goto(base + '/admin', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click()
  assert.equal(store.approved, true)
  await page.getByRole('button', { name: 'Aprovados', exact: true }).click()
  await page.getByRole('heading', { name: store.name, exact: true }).waitFor()
  await page.screenshot({
    path: path.join(output, 'admin.png'),
    fullPage: true,
  })
  role = 'STORE_OWNER'
  await page.goto(base + '/meu-sebo', { waitUntil: 'domcontentloaded' })
  const editor = page.locator('#book-editor')
  await editor.waitFor()
  await editor
    .getByLabel('Titulo', { exact: true })
    .fill('Livro de verificação')
  await editor.getByLabel('Autor', { exact: true }).fill('Autor de teste')
  await editor.getByLabel('Preco', { exact: true }).fill('29.90')
  await editor
    .getByRole('button', { name: 'Cadastrar livro', exact: true })
    .click()
  await page.locator('.inventory-item').waitFor()
  assert.equal(books.length, 1)
  await page.getByRole('button', { name: 'Editar livro', exact: true }).click()
  await editor.getByLabel('Preco', { exact: true }).fill('19.90')
  await editor
    .getByRole('button', { name: 'Salvar alteracoes', exact: true })
    .click()
  await page.getByText('Livro atualizado no acervo.').waitFor()
  assert.equal(books[0].price, 19.9)
  await page.screenshot({
    path: path.join(output, 'store-inventory.png'),
    fullPage: true,
  })
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Catálogo' })
    .click()
  await page.locator('.favorite-button').first().click()
  await page
    .getByText('“Livro de verificação” foi salvo nos seus desejos.')
    .waitFor()
  assert.equal(wishes.length, 1)
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Minha conta' })
    .click()
  await page.locator('.wishlist-item').waitFor()
  assert.equal(await page.locator('.wishlist-item').count(), 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Meu sebo' })
    .click()
  await page.locator('#book-editor').waitFor()
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Store panel fits mobile',
  )
  await page.screenshot({
    path: path.join(output, 'store-mobile.png'),
    fullPage: true,
  })
  page.on('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remover livro', exact: true }).click()
  await page.getByText('Livro removido do acervo.').waitFor()
  assert.equal(books.length, 0)
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        backend: 'intercepted fixtures; no production writes',
        checks: [
          'pending store blocked',
          'admin approval',
          'create/edit/delete book',
          'wishlist persisted',
          'mobile store panel',
        ],
        writes,
        screenshots: output,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
