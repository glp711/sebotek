import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Gift, Loader2, MessageCircle, PackageCheck, RefreshCw, X } from 'lucide-react'
import { whatsappUrl } from '../lib/catalogFilters'
import { loadStoreDonations, respondToDonation } from '../lib/donations'
import { friendlyErrorMessage } from '../lib/friendlyErrors'
import { donationDeliveryLabel, donationStatusLabel, formatDate } from '../lib/labels'
import type { DonationRecord } from '../types'

type Filter = 'open' | 'done' | 'all'

const isOpen = (donation: DonationRecord) =>
  donation.status === 'PENDING' || donation.status === 'ACCEPTED'

export function StoreDonations({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [donations, setDonations] = useState<DonationRecord[]>([])
  const [filter, setFilter] = useState<Filter>('open')
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setDonations(await loadStoreDonations(storeId))
    } catch (error) {
      setMessage(friendlyErrorMessage(error, 'Não foi possível carregar as doações.'))
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    void Promise.resolve().then(refresh)
  }, [refresh])

  const visible = useMemo(
    () =>
      donations.filter((donation) =>
        filter === 'all' ? true : filter === 'open' ? isOpen(donation) : !isOpen(donation),
      ),
    [donations, filter],
  )
  const pendingCount = donations.filter((donation) => donation.status === 'PENDING').length

  const respond = async (
    donation: DonationRecord,
    status: 'ACCEPTED' | 'DECLINED' | 'RECEIVED',
  ) => {
    setSavingId(donation.id)
    setMessage(null)
    try {
      await respondToDonation(donation.id, status, responses[donation.id] ?? donation.storeResponse ?? '')
      await refresh()
      setMessage(
        status === 'ACCEPTED'
          ? `Doação de ${donation.donorName} aceita. Combine a entrega pelo WhatsApp.`
          : status === 'RECEIVED'
            ? 'Doação marcada como recebida. Obrigado por registrar!'
            : 'Doação recusada. O doador verá sua resposta.',
      )
    } catch (error) {
      setMessage(friendlyErrorMessage(error, 'Não foi possível atualizar a doação.'))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="owner-card donations-card" id="store-donations" aria-labelledby="store-donations-title">
      <div className="section-heading compact">
        <div>
          <p className="section-kicker">Doações recebidas</p>
          <h2 id="store-donations-title">
            Ofertas de livros {pendingCount > 0 && <span className="count-badge">{pendingCount} nova{pendingCount > 1 ? 's' : ''}</span>}
          </h2>
        </div>
        <button
          className="icon-button"
          type="button"
          title="Atualizar doações"
          aria-label="Atualizar doações"
          onClick={() => void refresh()}
        >
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="segmented" aria-label="Filtro de doações">
        {(
          [
            ['open', 'Em aberto'],
            ['done', 'Finalizadas'],
            ['all', 'Todas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'active' : ''}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state" role="status">
          <Loader2 className="spin" size={22} />
          Carregando doações...
        </div>
      ) : visible.length === 0 ? (
        <div className="inventory-empty">
          <Gift size={22} />
          <p>
            {filter === 'open'
              ? `Nenhuma oferta em aberto. Leitores podem oferecer livros para ${storeName} pela página Doar livros.`
              : 'Nenhuma doação nesta lista.'}
          </p>
        </div>
      ) : (
        <div className="donation-list">
          {visible.map((donation) => {
            const chat = whatsappUrl(
              donation.contactPhone,
              `Oi, ${donation.donorName}! Aqui é do ${storeName}. Vi sua oferta de doação no Sebo Virtual. Vamos combinar?`,
            )
            const saving = savingId === donation.id
            return (
              <article className="donation-item" key={donation.id}>
                <div className="donation-item-head">
                  <strong>{donation.donorName}</strong>
                  <span className={`status-badge status-${donation.status.toLowerCase()}`}>
                    {donationStatusLabel[donation.status]}
                  </span>
                </div>
                <p>{donation.booksDescription}</p>
                <small>
                  {donation.estimatedQuantity} {donation.estimatedQuantity === 1 ? 'livro' : 'livros'} ·{' '}
                  {donationDeliveryLabel[donation.deliveryMethod]}
                  {donation.pickupArea ? ` (${donation.pickupArea})` : ''} · {formatDate(donation.createdAt)}
                </small>
                {donation.message && <blockquote>{donation.message}</blockquote>}

                {isOpen(donation) && (
                  <label className="donation-response">
                    Resposta para o doador (opcional)
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={responses[donation.id] ?? donation.storeResponse ?? ''}
                      onChange={(event) =>
                        setResponses((current) => ({ ...current, [donation.id]: event.target.value }))
                      }
                      placeholder="Ex: Pode trazer de terça a sábado, das 10h às 18h."
                    />
                  </label>
                )}
                {!isOpen(donation) && donation.storeResponse && (
                  <blockquote>Sua resposta: {donation.storeResponse}</blockquote>
                )}

                <div className="donation-actions">
                  {chat && donation.status !== 'CANCELLED' && (
                    <a className="secondary-action" href={chat} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} />
                      WhatsApp do doador
                    </a>
                  )}
                  {donation.status === 'PENDING' && (
                    <button
                      className="primary-action"
                      type="button"
                      disabled={saving}
                      onClick={() => void respond(donation, 'ACCEPTED')}
                    >
                      {saving ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
                      Aceitar doação
                    </button>
                  )}
                  {donation.status === 'ACCEPTED' && (
                    <button
                      className="primary-action"
                      type="button"
                      disabled={saving}
                      onClick={() => void respond(donation, 'RECEIVED')}
                    >
                      {saving ? <Loader2 className="spin" size={16} /> : <PackageCheck size={16} />}
                      Marcar como recebida
                    </button>
                  )}
                  {isOpen(donation) && (
                    <button
                      className="text-button"
                      type="button"
                      disabled={saving}
                      onClick={() => void respond(donation, 'DECLINED')}
                    >
                      <X size={15} />
                      Recusar
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
