// Validações feitas no navegador antes de enviar dados ao Supabase.
// Os mesmos limites também existem no banco (migration
// 20261119120000_harden_data_constraints.sql), que é a proteção definitiva;
// aqui o objetivo é dar uma mensagem clara antes do envio.
import type { BookDraft, StoreDraft } from '../types'

export const LIMITS = {
  bookTitle: 300,
  bookAuthor: 200,
  bookCategory: 80,
  bookPublisher: 200,
  bookSummary: 5000,
  coverUrl: 2048,
  maxPrice: 100000,
  maxQuantity: 10000,
  minYear: 1400,
  maxYear: 2100,
  storeName: 120,
  storeDescription: 2000,
  storeAddress: 300,
  storeCity: 120,
  openingHours: 200,
  displayName: 80,
  wishlistTitle: 300,
  wishlistAuthor: 200,
} as const

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

const digits = (value: string) => value.replace(/\D/g, '')

const tooLong = (value: string, max: number) => value.trim().length > max

export function validateBookDraft(draft: BookDraft): string | null {
  if (!draft.title.trim()) return 'Informe o título do livro.'
  if (!draft.author.trim()) return 'Informe o autor do livro.'
  if (tooLong(draft.title, LIMITS.bookTitle))
    return `O título pode ter no máximo ${LIMITS.bookTitle} caracteres.`
  if (tooLong(draft.author, LIMITS.bookAuthor))
    return `O autor pode ter no máximo ${LIMITS.bookAuthor} caracteres.`
  if (tooLong(draft.category, LIMITS.bookCategory))
    return `A categoria pode ter no máximo ${LIMITS.bookCategory} caracteres.`
  if (tooLong(draft.publisher, LIMITS.bookPublisher))
    return `A editora pode ter no máximo ${LIMITS.bookPublisher} caracteres.`
  if (tooLong(draft.summary, LIMITS.bookSummary))
    return `O resumo pode ter no máximo ${LIMITS.bookSummary} caracteres.`

  const price = Number(draft.price.replace(',', '.'))
  if (draft.price.trim() === '' || !Number.isFinite(price) || price < 0)
    return 'Informe um preço válido, igual ou maior que zero.'
  if (price > LIMITS.maxPrice)
    return `O preço máximo permitido é R$ ${LIMITS.maxPrice.toLocaleString('pt-BR')}.`

  const quantity = Number(draft.quantity || 0)
  if (!Number.isInteger(quantity) || quantity < 0)
    return 'A quantidade precisa ser um número inteiro igual ou maior que zero.'
  if (quantity > LIMITS.maxQuantity)
    return `A quantidade máxima por título é ${LIMITS.maxQuantity}.`

  if (draft.publishedYear.trim()) {
    const year = Number(draft.publishedYear)
    if (!Number.isInteger(year) || year < LIMITS.minYear || year > LIMITS.maxYear)
      return `Informe um ano entre ${LIMITS.minYear} e ${LIMITS.maxYear}.`
  }

  if (draft.isbn.trim()) {
    const isbnDigits = draft.isbn.replace(/[^0-9Xx]/g, '')
    if (isbnDigits.length !== 10 && isbnDigits.length !== 13)
      return 'O ISBN deve ter 10 ou 13 dígitos (hífens são permitidos).'
  }

  const coverUrl = draft.coverUrl.trim()
  if (coverUrl) {
    if (coverUrl.length > LIMITS.coverUrl) return 'O endereço da capa é muito longo.'
    if (!/^https?:\/\//i.test(coverUrl))
      return 'O endereço da capa precisa começar com http:// ou https://.'
  }

  return null
}

export function validateStoreDraft(draft: StoreDraft): string | null {
  const name = draft.name.trim()
  if (name.length < 2) return 'Informe o nome do sebo.'
  if (name.length > LIMITS.storeName)
    return `O nome do sebo pode ter no máximo ${LIMITS.storeName} caracteres.`
  if (tooLong(draft.description, LIMITS.storeDescription))
    return `A descrição pode ter no máximo ${LIMITS.storeDescription} caracteres.`
  if (!draft.address.trim()) return 'Informe o endereço do sebo.'
  if (tooLong(draft.address, LIMITS.storeAddress))
    return `O endereço pode ter no máximo ${LIMITS.storeAddress} caracteres.`
  if (!draft.city.trim()) return 'Informe a cidade do sebo.'
  if (tooLong(draft.city, LIMITS.storeCity))
    return `A cidade pode ter no máximo ${LIMITS.storeCity} caracteres.`

  const state = draft.state.trim().toUpperCase()
  if (!(BRAZILIAN_STATES as readonly string[]).includes(state))
    return 'Informe uma UF válida com duas letras, como RJ ou SP.'

  if (draft.zipCode.trim() && digits(draft.zipCode).length !== 8)
    return 'O CEP deve ter 8 dígitos.'

  const phoneDigits = digits(draft.phone)
  if (phoneDigits.length < 10 || phoneDigits.length > 13)
    return 'Informe um telefone com DDD, por exemplo (21) 99999-0000. Ele é usado no botão do WhatsApp.'

  if (tooLong(draft.openingHours, LIMITS.openingHours))
    return `O horário pode ter no máximo ${LIMITS.openingHours} caracteres.`

  return null
}
