// Validações feitas no navegador antes de enviar dados ao Supabase.
// Os mesmos limites também existem no banco (migration
// 20261119120000_harden_data_constraints.sql), que é a proteção definitiva;
// aqui o objetivo é dar uma mensagem clara antes do envio.
import type {
  BookDraft,
  ContactDraft,
  ContactTopic,
  DonationDraft,
  StoreDraft,
} from '../types'

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
  donorName: 120,
  donationBooks: 2000,
  maxDonationQuantity: 500,
  pickupArea: 200,
  donationMessage: 1000,
  contactName: 120,
  contactMessage: 3000,
} as const

export const CONTACT_TOPICS: readonly ContactTopic[] = [
  'DUVIDA',
  'SEBO',
  'DOACAO',
  'PROBLEMA',
  'SUGESTAO',
]

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

export function validateDonationDraft(draft: DonationDraft): string | null {
  if (!draft.storeId) return 'Escolha o sebo que vai receber a doação.'
  const name = draft.donorName.trim()
  if (name.length < 2 || name.length > LIMITS.donorName)
    return 'Informe seu nome para o sebo saber quem está doando.'
  const phoneDigits = digits(draft.contactPhone)
  if (phoneDigits.length < 10 || phoneDigits.length > 13)
    return 'Informe um telefone com DDD para o sebo combinar a entrega.'
  const books = draft.booksDescription.trim()
  if (books.length < 3) return 'Descreva os livros que deseja doar.'
  if (books.length > LIMITS.donationBooks)
    return `A lista de livros pode ter no máximo ${LIMITS.donationBooks} caracteres.`
  const quantity = Number(draft.estimatedQuantity)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > LIMITS.maxDonationQuantity)
    return `Informe uma quantidade entre 1 e ${LIMITS.maxDonationQuantity} livros.`
  if (draft.deliveryMethod === 'PICKUP') {
    const area = draft.pickupArea.trim()
    if (area.length < 3) return 'Informe o bairro e a cidade para a retirada.'
    if (area.length > LIMITS.pickupArea)
      return `O local de retirada pode ter no máximo ${LIMITS.pickupArea} caracteres.`
  }
  if (tooLong(draft.message, LIMITS.donationMessage))
    return `A mensagem pode ter no máximo ${LIMITS.donationMessage} caracteres.`
  return null
}

export function validateContactDraft(draft: ContactDraft): string | null {
  const name = draft.name.trim()
  if (name.length < 2 || name.length > LIMITS.contactName) return 'Informe seu nome.'
  const email = draft.email.trim()
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return 'Informe um e-mail válido para receber a resposta.'
  if (!CONTACT_TOPICS.includes(draft.topic)) return 'Escolha o assunto da mensagem.'
  const message = draft.message.trim()
  if (message.length < 10) return 'Escreva uma mensagem com pelo menos 10 caracteres.'
  if (message.length > LIMITS.contactMessage)
    return `A mensagem pode ter no máximo ${LIMITS.contactMessage} caracteres.`
  return null
}
