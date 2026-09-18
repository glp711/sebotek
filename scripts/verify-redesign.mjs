import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.QA_URL ?? 'http://127.0.0.1:5174'
const output = path.join(tmpdir(), 'sebo-virtual-qa')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.setDefaultTimeout(15000)
page.setDefaultNavigationTimeout(20000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
try {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page
    .locator('.catalog-results[aria-busy="false"]')
    .waitFor({ state: 'attached', timeout: 45000 })
  const count = await page.locator('.book-card').count()
  assert.ok(count > 0, 'Catalog should show available books')
  await page.screenshot({
    path: path.join(output, 'desktop.png'),
    fullPage: true,
  })
  console.log('Catalog loaded:', count)
  const first = page.locator('.book-card-main').first()
  await first.click()
  await page.getByRole('dialog').waitFor()
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-label'),
    ),
    'Fechar',
  )
  await page.keyboard.press('Shift+Tab')
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement),
    ),
    'Focus remains in the dialog',
  )
  await page.screenshot({ path: path.join(output, 'book-details.png') })
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)
  assert.ok(
    await first.evaluate((element) => element === document.activeElement),
    'Focus returns to book',
  )
  console.log('Dialog and keyboard passed')
  await page.getByRole('button', { name: 'Lista', exact: true }).click()
  assert.equal(await page.locator('.list-view').count(), 1)
  await page.getByRole('button', { name: 'Grade', exact: true }).click()
  await page.getByLabel('Preço máximo (R$)').fill('0')
  assert.equal(await page.locator('.book-card').count(), 0)
  await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
  assert.equal(await page.locator('.book-card').count(), count)
  console.log('Filters passed')
  await page.getByLabel('Buscar livros').fill('marina')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  assert.ok(page.url().includes('q=marina'))
  assert.ok((await page.locator('.book-card').count()) >= 1)
  await page.reload()
  await page
    .locator('.catalog-results[aria-busy="false"]')
    .waitFor({ state: 'attached', timeout: 45000 })
  assert.equal(await page.getByLabel('Buscar livros').inputValue(), 'marina')
  console.log('Search and reload passed')
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Minha conta' })
    .click()
  await page
    .getByRole('button', { name: 'Continuar com Google', exact: true })
    .waitFor()
  await page.getByRole('button', { name: 'Cadastrar', exact: true }).click()
  await page
    .getByRole('button', { name: 'Cadastrar com Google', exact: true })
    .waitFor()
  await page.getByLabel('Nome', { exact: true }).fill('Teste de interface')
  await page
    .getByLabel('Email', { exact: true })
    .fill('interface@example.invalid')
  await page.getByLabel('Senha', { exact: true }).fill('abcdef')
  await page.getByLabel('Confirmar senha', { exact: true }).fill('ghijkl')
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await page
    .getByText('As senhas não conferem. Confira os dois campos.')
    .waitFor()
  await page.getByRole('button', { name: 'Mostrar senha', exact: true }).click()
  assert.equal(
    await page.getByLabel('Senha', { exact: true }).getAttribute('type'),
    'text',
  )
  await page.screenshot({
    path: path.join(output, 'account.png'),
    fullPage: true,
  })
  console.log('Account validation passed')
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Meu sebo' })
    .click()
  assert.ok(page.url().endsWith('/meu-sebo'))
  await page.reload()
  await page.getByRole('heading', { name: 'Entrar no painel' }).waitFor()
  await page.goBack()
  assert.ok(page.url().endsWith('/conta'))
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Sebos parceiros' })
    .click()
  await page.locator('.store-card').first().waitFor()
  await page
    .getByRole('button', { name: 'Ver acervo', exact: true })
    .first()
    .click()
  assert.ok(page.url().includes('sebo='))
  assert.ok((await page.locator('.book-card').count()) > 0)
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Catálogo' })
    .click()
  await page.locator('.favorite-button').first().click()
  await page
    .getByText('Entre na sua conta para salvar livros na lista de desejos.')
    .waitFor()
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(base + '/catalogo', { waitUntil: 'domcontentloaded' })
    await page
      .locator('.catalog-results[aria-busy="false"]')
      .waitFor({ state: 'attached', timeout: 45000 })
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'No page overflow at ' + width,
    )
    await page.getByRole('button', { name: 'Filtros', exact: true }).click()
    assert.equal(
      await page
        .getByRole('button', { name: 'Filtros', exact: true })
        .getAttribute('aria-expanded'),
      'true',
    )
    await page.locator('.category-options label').nth(1).click()
    assert.ok((await page.locator('.book-card').count()) > 0)
    await page.screenshot({
      path: path.join(output, 'mobile-' + width + '.png'),
      fullPage: true,
    })
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Minha conta' })
      .click()
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).waitFor()
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      'Account no overflow at ' + width,
    )
  }
  await page.goto(
    base + '/auth/confirm?error_description=Expired&intent=store',
    { waitUntil: 'domcontentloaded' },
  )
  await page
    .getByRole('heading', { name: 'Não foi possível confirmar' })
    .waitFor()
  await page
    .getByRole('button', { name: 'Ir para Meu sebo', exact: true })
    .click()
  assert.ok(page.url().endsWith('/meu-sebo'))
  await page.goto(base + '/auth/reset-password', {
    waitUntil: 'domcontentloaded',
  })
  assert.ok(
    await page.getByRole('button', { name: 'Atualizar senha' }).isDisabled(),
  )
  await page.evaluate(() =>
    sessionStorage.setItem('sebo-virtual:oauth-intent', 'store'),
  )
  await page.goto(base + '/auth/oauth?error_description=Access%20denied', {
    waitUntil: 'domcontentloaded',
  })
  await page
    .getByRole('heading', { name: 'Não foi possível entrar com Google' })
    .waitFor()
  await page.getByRole('button', { name: 'Voltar para entrar' }).click()
  assert.ok(page.url().endsWith('/meu-sebo'))
  assert.deepEqual(errors, [], 'No unhandled browser errors')
  console.log(
    JSON.stringify(
      {
        status: 'passed',
        books: count,
        screenshots: output,
        checked: [
          'book dialog and focus',
          'search and refresh',
          'filters',
          'grid/list',
          'account validation',
          'Google OAuth entry and callback',
          'routes and back',
          'store catalog',
          'wishlist login',
          'mobile 320/390/768',
        ],
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
