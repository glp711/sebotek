import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Gift, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { whatsappUrl } from '../lib/catalogFilters'
import { cancelDonation, createDonation, loadMyDonations } from '../lib/donations'
import { friendlyErrorMessage } from '../lib/friendlyErrors'
import { donationDeliveryLabel, donationStatusLabel, formatDate } from '../lib/labels'
import type { AuthSession } from '../lib/supabase'
import { LIMITS } from '../lib/validation'
import type { DonationDraft, DonationRecord, StoreRecord } from '../types'

const emptyDraft = (storeId: string, donorName: string): DonationDraft => ({
  storeId,
  donorName,
  contactPhone: '',
  booksDescription: '',
  estimatedQuantity: '1',
  deliveryMethod: 'DROP_OFF',
  pickupArea: '',
  message: '',
})

export function DonationView({
  session,
  stores,
  initialStoreId,
  defaultName,
  authBox,
}: {
  session: AuthSession | null
  stores: StoreRecord[]
  initialStoreId: string
  defaultName: string
  authBox: ReactNode
}) {
  const approvedStores = stores.filter((store) => store.approved)
  const [draft, setDraft] = useState<DonationDraft>(() =>
    emptyDraft(initialStoreId, defaultName),
  )
  const [donations, setDonations] = useState<DonationRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!session) {
      setDonations([])
      return
    }
    setDonations(await loadMyDonations())
  }, [session])

  useEffect(() => {
    void Promise.resolve()
      .then(refresh)
      .catch((error) =>
        setMessage(friendlyErrorMessage(error, 'Não foi possível carregar suas doações.')),
      )
  }, [refresh])

  const update = <K extends keyof DonationDraft>(key: K, value: DonationDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await createDonation(draft)
      const storeName = approvedStores.find((store) => store.id === draft.storeId)?.name
      setDraft(emptyDraft('', draft.donorName))
      await refresh()
      setMessage(
        `Doação enviada${storeName ? ` para ${storeName}` : ''}. O sebo vai analisar e responder por aqui.`,
      )
    } catch (error) {
      setMessage(friendlyErrorMessage(error, 'Não foi possível enviar a doação.'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async (donation: DonationRecord) => {
    if (!window.confirm('Cancelar esta oferta de doação?')) return
    setSaving(true)
    setMessage(null)
    try {
      await cancelDonation(donation.id)
      await refresh()
      setMessage('Doação cancelada.')
    } catch (error) {
      setMessage(friendlyErrorMessage(error, 'Não foi possível cancelar a doação.'))
    } finally {
      setSaving(false)
    }
  }

  const howItWorks = (
    <ol className="donation-steps">
      <li>Escolha um sebo parceiro e descreva os livros.</li>
      <li>O sebo avalia a oferta e aceita ou recusa.</li>
      <li>Vocês combinam a entrega ou a retirada pelo WhatsApp.</li>
      <li>O sebo confirma quando receber os livros.</li>
    </ol>
  )

  if (!session) {
    return (
      <div className="owner-layout">
        {authBox}
        <aside className="owner-note">
          <Gift size={24} />
          <h3>Doe livros para um sebo</h3>
          <p>
            Livros parados em casa podem ganhar novos leitores. Entre na sua conta para
            oferecer uma doação a um sebo parceiro.
          </p>
          {howItWorks}
        </aside>
      </div>
    )
  }

  return (
    <div className="owner-layout">
      <section className="owner-card">
        <div className="section-heading compact">
          <div>
            <p className="section-kicker">Doação de livros</p>
            <h2>Oferecer livros a um sebo</h2>
          </div>
        </div>

        {approvedStores.length === 0 ? (
          <p className="form-message">
            Ainda não há sebos verificados para receber doações. Volte mais tarde.
          </p>
        ) : (
          <form className="stack-form" onSubmit={handleSubmit} id="donation-form">
            <label>
              Sebo que vai receber
              <select
                required
                value={draft.storeId}
                onChange={(event) => update('storeId', event.target.value)}
              >
                <option value="">Escolha um sebo</option>
                {approvedStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} · {store.city}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Livros para doar
              <textarea
                required
                rows={4}
                maxLength={LIMITS.donationBooks}
                value={draft.booksDescription}
                onChange={(event) => update('booksDescription', event.target.value)}
                placeholder="Ex: 10 romances em bom estado, coleção Harry Potter completa, livros didáticos do ensino médio..."
              />
            </label>
            <div className="form-row">
              <label>
                Quantidade aproximada
                <input
                  required
                  type="number"
                  min="1"
                  max={LIMITS.maxDonationQuantity}
                  step="1"
                  value={draft.estimatedQuantity}
                  onChange={(event) => update('estimatedQuantity', event.target.value)}
                />
              </label>
              <label>
                Entrega
                <select
                  value={draft.deliveryMethod}
                  onChange={(event) =>
                    update('deliveryMethod', event.target.value as DonationDraft['deliveryMethod'])
                  }
                >
                  <option value="DROP_OFF">{donationDeliveryLabel.DROP_OFF}</option>
                  <option value="PICKUP">{donationDeliveryLabel.PICKUP}</option>
                </select>
              </label>
            </div>
            {draft.deliveryMethod === 'PICKUP' && (
              <label>
                Bairro e cidade para retirada
                <input
                  required
                  maxLength={LIMITS.pickupArea}
                  value={draft.pickupArea}
                  onChange={(event) => update('pickupArea', event.target.value)}
                  placeholder="Ex: Tijuca, Rio de Janeiro"
                />
              </label>
            )}
            <div className="form-row">
              <label>
                Seu nome
                <input
                  required
                  maxLength={LIMITS.donorName}
                  value={draft.donorName}
                  onChange={(event) => update('donorName', event.target.value)}
                />
              </label>
              <label>
                WhatsApp para contato
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  maxLength={20}
                  value={draft.contactPhone}
                  onChange={(event) => update('contactPhone', event.target.value)}
                  placeholder="(21) 99999-0000"
                />
              </label>
            </div>
            <label>
              Mensagem para o sebo
              <textarea
                rows={3}
                maxLength={LIMITS.donationMessage}
                value={draft.message}
                onChange={(event) => update('message', event.target.value)}
                placeholder="Opcional: melhores dias e horários, estado dos livros..."
              />
            </label>
            <p className="field-hint">
              Seu nome e seu telefone ficam visíveis apenas para o sebo escolhido.
            </p>
            <button className="primary-action" disabled={saving} type="submit">
              {saving ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              Enviar oferta de doação
            </button>
          </form>
        )}
        {message && (
          <p className="form-message" role="status">
            {message}
          </p>
        )}
      </section>

      <aside className="owner-note donation-note" id="my-donations">
        <Gift size={24} />
        <h3>Minhas doações</h3>
        {donations.length === 0 ? (
          <>
            <p>Você ainda não ofereceu livros. Veja como funciona:</p>
            {howItWorks}
          </>
        ) : (
          <div className="donation-list">
            {donations.map((donation) => {
              const chat =
                donation.storePhone && donation.status === 'ACCEPTED'
                  ? whatsappUrl(
                      donation.storePhone,
                      `Oi! Sou ${donation.donorName} e ofereci uma doação de livros pelo Sebo Virtual. Podemos combinar a entrega?`,
                    )
                  : undefined
              return (
                <article className="donation-item" key={donation.id}>
                  <div className="donation-item-head">
                    <strong>{donation.storeName ?? 'Sebo parceiro'}</strong>
                    <span className={`status-badge status-${donation.status.toLowerCase()}`}>
                      {donationStatusLabel[donation.status]}
                    </span>
                  </div>
                  <p>{donation.booksDescription}</p>
                  <small>
                    {donation.estimatedQuantity}{' '}
                    {donation.estimatedQuantity === 1 ? 'livro' : 'livros'} ·{' '}
                    {donationDeliveryLabel[donation.deliveryMethod]} ·{' '}
                    {formatDate(donation.createdAt)}
                  </small>
                  {donation.storeResponse && (
                    <blockquote>Resposta do sebo: {donation.storeResponse}</blockquote>
                  )}
                  <div className="donation-actions">
                    {chat && (
                      <a className="secondary-action" href={chat} target="_blank" rel="noreferrer">
                        <MessageCircle size={16} />
                        Combinar pelo WhatsApp
                      </a>
                    )}
                    {donation.status === 'PENDING' && (
                      <button
                        className="text-button"
                        type="button"
                        disabled={saving}
                        onClick={() => void handleCancel(donation)}
                      >
                        <X size={15} />
                        Cancelar oferta
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </aside>
    </div>
  )
}
