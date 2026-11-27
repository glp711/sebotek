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
const donations = [
  {
    id: 'donation-test',
    donor_id: '33333333-3333-4333-8333-333333333333',
    store_id: store.id,
    donor_name: 'Doadora de teste',
    contact_phone: '21988887777',
    books_description: '12 romances em bom estado',
    estimated_quantity: 12,
    delivery_method: 'DROP_OFF',
    pickup_area: null,
    message: 'Posso levar no sábado.',
    status: 'PENDING',
    store_response: null,
    created_at: '2026-11-18T12:00:00Z',
    stores: { name: store.name, phone: store.phone },
  },
]
const contactMessages = []
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
    if(url.pathname.includes('/storage/v1/')){
      if(request.method()==='GET')return route.fulfill({path:'public/covers/marina.png',contentType:'image/png'})
      return route.fulfill({json:{Key:'book-covers/test-copy.png'}})
    }
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
      if (
        table === 'books' &&
        method === 'PATCH' &&
        url.searchParams.has('select')
      )
        return route.fulfill({ json: { id: books[0].id } })
      if (table === 'reader_demand') return route.fulfill({ json: [] })
      if (table === 'books' && method === 'DELETE') books.splice(0)
      if (table === 'wishlists' && method === 'POST')
        wishes.push({ id: 'wish-test', ...payload, notified: false })
      if (table === 'donations' && method === 'PATCH') {
        const id = url.searchParams.get('id')?.replace('eq.', '')
        Object.assign(donations.find((item) => item.id === id) ?? {}, payload)
      }
      if (table === 'donations' && method === 'POST')
        donations.push({
          id: 'donation-new',
          donor_id: userId,
          status: 'PENDING',
          created_at: '2026-11-19T12:00:00Z',
          ...payload,
          stores: { name: store.name, phone: store.phone },
        })
      if (table === 'contact_messages' && method === 'POST')
        contactMessages.push({
          id: 'message-test',
          resolved: false,
          created_at: '2026-11-19T12:00:00Z',
          ...payload,
        })
      if (table === 'contact_messages' && method === 'PATCH')
        Object.assign(contactMessages[0] ?? {}, payload)
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
    if (table === 'donations')
      data = url.searchParams.get('donor_id')
        ? donations.filter((item) => item.donor_id === userId)
        : donations.filter((item) => item.donor_id !== userId)
    if (table === 'contact_messages') data = contactMessages
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
    .getByRole('heading', { name: 'Sebo aguardando aprovação' })
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
    .getByLabel('Título', { exact: true })
    .fill('Livro de verificação')
  await editor.getByLabel('Autor', { exact: true }).fill('Autor de teste')
  await editor.getByLabel('Preço', { exact: true }).fill('29.90')
  await editor.locator('input[type="file"]').setInputFiles('public/covers/marina.png')
  await editor.locator('.copy-photo-list img').waitFor()
  await editor.locator('.copy-photo-list img').evaluate(img=>img.decode())
  await editor
    .getByLabel('Marcas de uso e detalhes')
    .fill('Dedicatória na primeira página')
  await editor
    .getByRole('button', { name: 'Cadastrar livro', exact: true })
    .click()
  await page.locator('.inventory-item').waitFor()
  assert.equal(books.length, 1)
  assert.equal(books[0].copy_photos.length,1)
  await page
    .getByRole('button', {
      name: 'Cadastrar outro exemplar de Livro de verificação',
    })
    .click()
  assert.equal(
    await editor.getByLabel('Título', { exact: true }).inputValue(),
    'Livro de verificação',
  )
  assert.equal(
    await editor.getByLabel('Marcas de uso e detalhes').inputValue(),
    '',
  )
  assert.equal(await editor.locator('.copy-photo-list img').count(),0)
  assert.equal(
    await editor.getByLabel('Quantidade', { exact: true }).inputValue(),
    '1',
  )
  await page.getByRole('button', { name: 'Editar livro', exact: true }).click()
  await editor.getByLabel('Preço', { exact: true }).fill('19.90')
  await editor
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click()
  await page.getByText('Livro atualizado no acervo.').waitFor()
  assert.equal(books[0].price, 19.9)
  await page.screenshot({
    path: path.join(output, 'store-inventory.png'),
    fullPage: true,
  })
  await page
    .getByLabel('Navegação principal')
    .getByRole('link', { name: 'Catálogo' })
    .click()
  await page.locator('.favorite-button').first().click()
  await page
    .getByText('“Livro de verificação” foi salvo nos seus desejos.')
    .waitFor()
  assert.equal(wishes.length, 1)
  await page
    .getByLabel('Navegação principal')
    .getByRole('link', { name: 'Minha conta' })
    .click()
  await page.locator('.wishlist-item').waitFor()
  assert.equal(await page.locator('.wishlist-item').count(), 1)
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByLabel('Navegação principal')
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

  // Doações recebidas pelo sebo
  await page.setViewportSize({ width: 1365, height: 960 })
  const received = page.locator('#store-donations')
  await received.getByText('12 romances em bom estado').waitFor()
  await received
    .getByLabel('Resposta para o doador (opcional)')
    .fill('Pode trazer no sábado de manhã.')
  await received
    .getByRole('button', { name: 'Aceitar doação', exact: true })
    .click()
  await page
    .getByText('Doação de Doadora de teste aceita.', { exact: false })
    .waitFor()
  assert.equal(donations[0].status, 'ACCEPTED')
  assert.equal(donations[0].store_response, 'Pode trazer no sábado de manhã.')
  await received
    .getByRole('button', { name: 'Marcar como recebida', exact: true })
    .click()
  await page
    .getByText('Doação marcada como recebida.', { exact: false })
    .waitFor()
  assert.equal(donations[0].status, 'RECEIVED')
  await page.screenshot({
    path: path.join(output, 'store-donations.png'),
    fullPage: true,
  })

  // Leitor oferece uma doação a partir de Sebos parceiros
  await page
    .getByLabel('Navegação principal')
    .getByRole('link', { name: 'Sebos parceiros' })
    .click()
  await page
    .getByRole('button', { name: 'Doar livros', exact: true })
    .first()
    .click()
  const donationForm = page.locator('#donation-form')
  await donationForm.waitFor()
  assert.equal(
    await donationForm.getByLabel('Sebo que vai receber').inputValue(),
    store.id,
  )
  await donationForm
    .getByLabel('Livros para doar')
    .fill('Coleção de clássicos brasileiros')
  await donationForm.getByLabel('Quantidade aproximada').fill('8')
  await donationForm.getByLabel('Entrega').selectOption('PICKUP')
  await donationForm
    .getByLabel('Bairro e cidade para retirada')
    .fill('Tijuca, Rio de Janeiro')
  await donationForm.getByLabel('WhatsApp para contato').fill('(21) 97777-6666')
  await donationForm
    .getByRole('button', { name: 'Enviar oferta de doação' })
    .click()
  await page
    .getByText('Doação enviada para Sebo de teste.', { exact: false })
    .waitFor()
  const created = donations.find((item) => item.id === 'donation-new')
  assert.equal(created?.delivery_method, 'PICKUP')
  assert.equal(created?.pickup_area, 'Tijuca, Rio de Janeiro')
  await page
    .locator('#my-donations')
    .getByText('Coleção de clássicos brasileiros')
    .waitFor()
  await page.getByRole('button', { name: 'Cancelar oferta' }).click()
  await page.getByText('Doação cancelada.').waitFor()
  assert.equal(created?.status, 'CANCELLED')
  await page.screenshot({
    path: path.join(output, 'donate.png'),
    fullPage: true,
  })

  // Formulário de contato
  await page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Contato' })
    .click()
  await page.getByLabel('Nome', { exact: true }).fill('Pessoa de teste')
  await page.getByLabel('Assunto').selectOption('SUGESTAO')
  await page
    .getByLabel('Mensagem', { exact: true })
    .fill('Seria ótimo ter avaliações dos sebos.')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await page.getByRole('heading', { name: 'Mensagem enviada' }).waitFor()
  assert.equal(contactMessages.length, 1)
  assert.equal(contactMessages[0].email, user.email)
  assert.equal(contactMessages[0].topic, 'SUGESTAO')

  // Administração lê e resolve a mensagem
  role = 'ADMIN'
  await page.goto(base + '/admin', { waitUntil: 'domcontentloaded' })
  const inbox = page.locator('#admin-messages')
  await inbox.getByText('Seria ótimo ter avaliações dos sebos.').waitFor()
  await inbox.getByRole('button', { name: 'Marcar como resolvida' }).click()
  await inbox.getByText('Nenhuma mensagem em aberto.').waitFor()
  assert.equal(contactMessages[0].resolved, true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base + '/doar', { waitUntil: 'domcontentloaded' })
  await page.locator('#donation-form').waitFor()
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'Donation page fits mobile',
  )
  await page.screenshot({
    path: path.join(output, 'donate-mobile.png'),
    fullPage: true,
  })
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
          'store accepts and receives donation',
          'reader offers and cancels donation',
          'contact form',
          'admin resolves contact message',
          'mobile donation page',
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
