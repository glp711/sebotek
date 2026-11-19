import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Inbox, Loader2, Mail, RefreshCw, RotateCcw } from 'lucide-react'
import { loadContactMessages, setContactMessageResolved } from '../lib/donations'
import { friendlyErrorMessage } from '../lib/friendlyErrors'
import { contactTopicLabel, formatDate } from '../lib/labels'
import type { ContactMessageRecord } from '../types'

export function AdminMessages() {
  const [messages, setMessages] = useState<ContactMessageRecord[]>([])
  const [showResolved, setShowResolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setMessages(await loadContactMessages())
    } catch (error) {
      setNotice(friendlyErrorMessage(error, 'Não foi possível carregar as mensagens.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(refresh)
  }, [refresh])

  const toggle = async (item: ContactMessageRecord) => {
    setSavingId(item.id)
    setNotice(null)
    try {
      await setContactMessageResolved(item.id, !item.resolved)
      await refresh()
    } catch (error) {
      setNotice(friendlyErrorMessage(error, 'Não foi possível atualizar a mensagem.'))
    } finally {
      setSavingId(null)
    }
  }

  const open = messages.filter((item) => !item.resolved)
  const visible = showResolved ? messages : open

  return (
    <section className="owner-card admin-messages-card" id="admin-messages">
      <div className="section-heading compact">
        <div>
          <p className="section-kicker">Contato</p>
          <h2>
            Mensagens recebidas{' '}
            {open.length > 0 && <span className="count-badge">{open.length} em aberto</span>}
          </h2>
        </div>
        <button
          className="icon-button"
          type="button"
          title="Atualizar mensagens"
          aria-label="Atualizar mensagens"
          onClick={() => void refresh()}
        >
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="segmented" aria-label="Filtro de mensagens">
        <button
          type="button"
          className={!showResolved ? 'active' : ''}
          aria-pressed={!showResolved}
          onClick={() => setShowResolved(false)}
        >
          Em aberto
        </button>
        <button
          type="button"
          className={showResolved ? 'active' : ''}
          aria-pressed={showResolved}
          onClick={() => setShowResolved(true)}
        >
          Todas
        </button>
      </div>

      {loading ? (
        <div className="empty-state" role="status">
          <Loader2 className="spin" size={22} />
          Carregando mensagens...
        </div>
      ) : visible.length === 0 ? (
        <div className="inventory-empty">
          <Inbox size={22} />
          <p>Nenhuma mensagem {showResolved ? 'recebida ainda' : 'em aberto'}.</p>
        </div>
      ) : (
        <div className="donation-list">
          {visible.map((item) => (
            <article className="donation-item" key={item.id}>
              <div className="donation-item-head">
                <strong>{item.name}</strong>
                <span className={`status-badge ${item.resolved ? 'status-received' : 'status-pending'}`}>
                  {item.resolved ? 'Resolvida' : contactTopicLabel[item.topic]}
                </span>
              </div>
              <p>{item.message}</p>
              <small>
                {item.email} · {formatDate(item.createdAt)}
              </small>
              <div className="donation-actions">
                <a
                  className="secondary-action"
                  href={`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(
                    `Re: ${contactTopicLabel[item.topic]} - Sebo Virtual`,
                  )}`}
                >
                  <Mail size={16} />
                  Responder por e-mail
                </a>
                <button
                  className="text-button"
                  type="button"
                  disabled={savingId === item.id}
                  onClick={() => void toggle(item)}
                >
                  {item.resolved ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />}
                  {item.resolved ? 'Reabrir' : 'Marcar como resolvida'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {notice && (
        <p className="form-message" role="status">
          {notice}
        </p>
      )}
    </section>
  )
}
