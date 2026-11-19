import type {
  ContactDraft,
  ContactMessageRecord,
  ContactTopic,
  DonationDraft,
  DonationRecord,
  DonationStatus,
} from '../types'
import { supabase } from './supabase'
import { validateContactDraft, validateDonationDraft } from './validation'

const notConfigured = () =>
  new Error(
    'Doações e contato precisam do Supabase configurado. No modo demonstração, essas ações ficam desativadas.',
  )

const donationColumns =
  'id,donor_id,store_id,donor_name,contact_phone,books_description,estimated_quantity,delivery_method,pickup_area,message,status,store_response,responded_at,created_at,stores(name,phone)'

const text = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : String(value)

const clean = (value: string) => value.trim() || null

export const normalizeDonation = (row: Record<string, unknown>): DonationRecord => {
  const store = (row.stores ?? null) as Record<string, unknown> | null
  return {
    id: String(row.id),
    donorId: String(row.donor_id ?? ''),
    storeId: String(row.store_id ?? ''),
    storeName: text(store?.name),
    storePhone: text(store?.phone),
    donorName: String(row.donor_name ?? ''),
    contactPhone: String(row.contact_phone ?? ''),
    booksDescription: String(row.books_description ?? ''),
    estimatedQuantity: Number(row.estimated_quantity ?? 1),
    deliveryMethod: row.delivery_method === 'PICKUP' ? 'PICKUP' : 'DROP_OFF',
    pickupArea: text(row.pickup_area),
    message: text(row.message),
    status: String(row.status ?? 'PENDING') as DonationStatus,
    storeResponse: text(row.store_response),
    respondedAt: text(row.responded_at),
    createdAt: text(row.created_at) ?? undefined,
  }
}

export async function createDonation(draft: DonationDraft) {
  if (!supabase) throw notConfigured()
  const invalid = validateDonationDraft(draft)
  if (invalid) throw new Error(invalid)

  const { error } = await supabase.from('donations').insert({
    store_id: draft.storeId,
    donor_name: draft.donorName.trim(),
    contact_phone: draft.contactPhone.trim(),
    books_description: draft.booksDescription.trim(),
    estimated_quantity: Number(draft.estimatedQuantity),
    delivery_method: draft.deliveryMethod,
    pickup_area: draft.deliveryMethod === 'PICKUP' ? clean(draft.pickupArea) : null,
    message: clean(draft.message),
  })
  if (error) throw error
}

export async function loadMyDonations(): Promise<DonationRecord[]> {
  if (!supabase) return []
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('donations')
    .select(donationColumns)
    .eq('donor_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => normalizeDonation(row))
}

export async function cancelDonation(id: string) {
  if (!supabase) throw notConfigured()
  const { error } = await supabase
    .from('donations')
    .update({ status: 'CANCELLED' })
    .eq('id', id)
  if (error) throw error
}

export async function loadStoreDonations(storeId: string): Promise<DonationRecord[]> {
  if (!supabase || !storeId) return []
  const { data, error } = await supabase
    .from('donations')
    .select(donationColumns)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => normalizeDonation(row))
}

export async function respondToDonation(
  id: string,
  status: Extract<DonationStatus, 'ACCEPTED' | 'DECLINED' | 'RECEIVED'>,
  response: string,
) {
  if (!supabase) throw notConfigured()
  if (response.trim().length > 1000)
    throw new Error('A resposta pode ter no máximo 1000 caracteres.')
  const { error } = await supabase
    .from('donations')
    .update({ status, store_response: clean(response) })
    .eq('id', id)
  if (error) throw error
}

export async function sendContactMessage(draft: ContactDraft) {
  if (!supabase) throw notConfigured()
  const invalid = validateContactDraft(draft)
  if (invalid) throw new Error(invalid)

  const { error } = await supabase.from('contact_messages').insert({
    name: draft.name.trim(),
    email: draft.email.trim(),
    topic: draft.topic,
    message: draft.message.trim(),
  })
  if (error) throw error
}

export async function loadContactMessages(): Promise<ContactMessageRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('contact_messages')
    .select('id,name,email,topic,message,resolved,created_at')
    .order('resolved', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    topic: String(row.topic ?? 'DUVIDA') as ContactTopic,
    message: String(row.message ?? ''),
    resolved: Boolean(row.resolved),
    createdAt: text(row.created_at) ?? undefined,
  }))
}

export async function setContactMessageResolved(id: string, resolved: boolean) {
  if (!supabase) throw notConfigured()
  const { error } = await supabase
    .from('contact_messages')
    .update({ resolved })
    .eq('id', id)
  if (error) throw error
}
