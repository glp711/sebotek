import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const base = process.env.QA_URL ?? 'http://127.0.0.1:5174'
const output = path.join(tmpdir(), 'sebo-virtual-qa')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const uid = '11111111-1111-4111-8111-111111111111'
const user = {
  id: uid,
  email: 'qa@example.invalid',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email' },
  user_metadata: {},
}
const store = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Sebo teste',
  city: 'Rio de Janeiro',
  state: 'RJ',
  approved: true,
  phone: '21999990000',
}
const book = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Marina',
  author: 'Carlos Ruiz Zafón',
  store_id: store.id,
  condition: 'GOOD',
  price: 30,
  quantity: 1,
  condition_notes: 'Dedicatória na primeira página',
  copy_photos: ['https://photos.example.invalid/marina.png'],
  cover_url: '/covers/marina.png',
  stores: store,
}
const copies = [
  book,
  {
    ...book,
    id: '44444444-4444-4444-8444-444444444444',
    condition: 'LIKE_NEW',
    price: 45,
    condition_notes: 'Sem marcas de uso',
  },
]
const pickups = []
let picked
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    })
    await context.addInitScript(
      ({ user }) => {
        const exp = Math.floor(Date.now() / 1000) + 3600
        localStorage.setItem(
          'sb-foaiugorywlkvxevogpi-auth-token',
          JSON.stringify({
            user,
            access_token:
              btoa('{}') +
              '.' +
              btoa(
                JSON.stringify({ sub: user.id, role: 'authenticated', exp }),
              ) +
              '.test',
            refresh_token: 'test',
            expires_at: exp,
            token_type: 'bearer',
          }),
        )
      },
      { user },
    )
    await context.route(
      'https://foaiugorywlkvxevogpi.supabase.co/**',
      async (route) => {
        const req = route.request(),
          url = new URL(req.url()),
          table = url.pathname.split('/').at(-1)
        if (url.pathname.includes('/auth/v1/'))
          return route.fulfill({ json: user })
        if (table === 'pickups' && req.method() === 'POST') {
          picked = req.postDataJSON().book_id
          pickups.splice(0, pickups.length, {
            id: '55555555-5555-4555-8555-555555555555',
            title: 'Marina',
            store_name: store.name,
            condition: 'LIKE_NEW',
            notes: 'Sem marcas de uso',
            price: 45,
            status: 'RESERVED',
          })
          return route.fulfill({ status: 201 })
        }
        if (table === 'pickups' && req.method() === 'PATCH') {
          pickups[0].status = req.postDataJSON().status
          return route.fulfill({ json: pickups[0] })
        }
        const data =
          table === 'books'
            ? copies
            : table === 'stores'
              ? [store]
              : table === 'profiles'
                ? [{ id: uid, display_name: 'Leitor teste', role: 'CUSTOMER' }]
                : table === 'wishlists'
                  ? [{ id: 'wish', title: 'Marina', user_id: uid }]
                  : table === 'pickups'
                    ? pickups
                    : []
        return route.fulfill({ json: data })
      },
    )
    const p = await context.newPage()
    await context.route('https://photos.example.invalid/**', (route) =>
      route.fulfill({
        path: 'public/covers/marina.png',
        contentType: 'image/png',
      }),
    )
    await p.goto(base)
    await p.locator('.book-card-main').first().click()
    const selector = p.getByLabel('Comparar exemplares')
    assert.equal(await selector.locator('option').count(), 2)
    await selector.selectOption(copies[1].id)
    await p.getByText('Sem marcas de uso', { exact: false }).first().waitFor()
    await p.getByRole('button', { name: 'Foto 1', exact: true }).click()
    await p.locator('.dialog-cover img').evaluate((i) => i.decode())
    assert.equal(
      await p
        .locator('.dialog-cover img')
        .evaluate((i) => getComputedStyle(i).objectFit),
      'contain',
    )
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    )
    await p.screenshot({ path: path.join(output, 'copies-' + width + '.png') })
    await p
      .getByRole('button', { name: 'Reservar para retirada', exact: true })
      .click()
    await p.getByRole('heading', { name: 'Minhas reservas' }).waitFor()
    assert.equal(picked, copies[1].id)
    await p
      .getByRole('button', { name: 'Cancelar reserva', exact: true })
      .click()
    await p
      .locator('.pickup-list')
      .getByText(/Cancelado/)
      .waitFor()
    await p.getByRole('button', { name: /Disponível em 1 sebo/ }).waitFor()
    await context.close()
  }
  console.log(
    'PASSED: comparison, real photos, selected-copy reservation, cancellation, wishlist match, desktop/mobile',
  )
} finally {
  await browser.close()
}
