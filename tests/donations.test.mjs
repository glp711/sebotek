import test from 'node:test'
import assert from 'node:assert/strict'
import { validateContactDraft, validateDonationDraft } from '../src/lib/validation.ts'

const donation = {
  storeId: '22222222-2222-4222-8222-222222222222',
  donorName: 'Ana Souza',
  contactPhone: '(21) 98888-7777',
  booksDescription: '12 romances e 3 livros infantis em bom estado',
  estimatedQuantity: '15',
  deliveryMethod: 'DROP_OFF',
  pickupArea: '',
  message: '',
}

const contact = {
  name: 'Ana Souza',
  email: 'ana@example.com',
  topic: 'DOACAO',
  message: 'Gostaria de saber como doar uma coleção grande.',
}

test('accepts a valid donation with drop-off or pickup', () => {
  assert.equal(validateDonationDraft(donation), null)
  assert.equal(
    validateDonationDraft({ ...donation, deliveryMethod: 'PICKUP', pickupArea: 'Tijuca, Rio de Janeiro' }),
    null,
  )
})

test('rejects incomplete donations before calling the database', () => {
  assert.match(validateDonationDraft({ ...donation, storeId: '' }), /Escolha o sebo/)
  assert.match(validateDonationDraft({ ...donation, contactPhone: '1234' }), /telefone/)
  assert.match(validateDonationDraft({ ...donation, booksDescription: ' ' }), /Descreva/)
  assert.match(validateDonationDraft({ ...donation, estimatedQuantity: '0' }), /quantidade/)
  assert.match(validateDonationDraft({ ...donation, estimatedQuantity: '501' }), /quantidade/)
  assert.match(validateDonationDraft({ ...donation, estimatedQuantity: '2.5' }), /quantidade/)
  assert.match(
    validateDonationDraft({ ...donation, deliveryMethod: 'PICKUP', pickupArea: '' }),
    /retirada/,
  )
})

test('validates contact messages', () => {
  assert.equal(validateContactDraft(contact), null)
  assert.match(validateContactDraft({ ...contact, email: 'ana@' }), /e-mail válido/)
  assert.match(validateContactDraft({ ...contact, message: 'Oi' }), /10 caracteres/)
  assert.match(validateContactDraft({ ...contact, topic: 'SPAM' }), /assunto/)
  assert.match(validateContactDraft({ ...contact, name: ' ' }), /nome/)
})
