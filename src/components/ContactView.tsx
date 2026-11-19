import { useState, type FormEvent } from 'react'
import { CheckCircle2, Gift, Loader2, Mail, Send, Store } from 'lucide-react'
import { sendContactMessage } from '../lib/donations'
import { friendlyErrorMessage } from '../lib/friendlyErrors'
import { contactTopicLabel } from '../lib/labels'
import { CONTACT_TOPICS, LIMITS } from '../lib/validation'
import type { ContactDraft } from '../types'

export function ContactView({
  defaultName,
  defaultEmail,
  onOpenStores,
  onOpenDonate,
  onOpenOwner,
}: {
  defaultName: string
  defaultEmail: string
  onOpenStores: () => void
  onOpenDonate: () => void
  onOpenOwner: () => void
}) {
  const [draft, setDraft] = useState<ContactDraft>({
    name: defaultName,
    email: defaultEmail,
    topic: 'DUVIDA',
    message: '',
  })
  // Campo invisível para pessoas: robôs de spam costumam preenchê-lo.
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const update = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    if (website) {
      setSent(true)
      return
    }
    setSending(true)
    try {
      await sendContactMessage(draft)
      setSent(true)
      setDraft((current) => ({ ...current, message: '' }))
    } catch (error) {
      setMessage(friendlyErrorMessage(error, 'Não foi possível enviar a mensagem.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="owner-layout">
      <section className="owner-card">
        <div className="section-heading compact">
          <div>
            <p className="section-kicker">Contato</p>
            <h2>Fale com a equipe do Sebo Virtual</h2>
          </div>
        </div>

        {sent ? (
          <div className="contact-success" role="status">
            <CheckCircle2 size={28} />
            <h3>Mensagem enviada</h3>
            <p>
              Obrigado pelo contato. A equipe responde pelo e-mail informado, normalmente em até
              dois dias úteis.
            </p>
            <button className="secondary-action" type="button" onClick={() => setSent(false)}>
              Enviar outra mensagem
            </button>
          </div>
        ) : (
          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                Nome
                <input
                  required
                  autoComplete="name"
                  maxLength={LIMITS.contactName}
                  value={draft.name}
                  onChange={(event) => update('name', event.target.value)}
                />
              </label>
              <label>
                E-mail para resposta
                <input
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={draft.email}
                  onChange={(event) => update('email', event.target.value)}
                />
              </label>
            </div>
            <label>
              Assunto
              <select
                value={draft.topic}
                onChange={(event) => update('topic', event.target.value as ContactDraft['topic'])}
              >
                {CONTACT_TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {contactTopicLabel[topic]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mensagem
              <textarea
                required
                rows={6}
                minLength={10}
                maxLength={LIMITS.contactMessage}
                value={draft.message}
                onChange={(event) => update('message', event.target.value)}
                placeholder="Conte como podemos ajudar."
              />
            </label>
            <label className="visually-hidden" aria-hidden="true">
              Site
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
            <p className="field-hint">
              Usamos seus dados apenas para responder esta mensagem.
            </p>
            <button className="primary-action" disabled={sending} type="submit">
              {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              Enviar mensagem
            </button>
          </form>
        )}
        {message && (
          <p className="form-message" role="alert">
            {message}
          </p>
        )}
      </section>

      <aside className="owner-note">
        <Mail size={24} />
        <h3>Antes de escrever</h3>
        <div className="contact-shortcuts">
          <button className="contact-shortcut" type="button" onClick={onOpenStores}>
            <Store size={18} />
            <span>
              <strong>Dúvida sobre um livro?</strong>
              Fale direto com o sebo pelo WhatsApp em Sebos parceiros.
            </span>
          </button>
          <button className="contact-shortcut" type="button" onClick={onOpenDonate}>
            <Gift size={18} />
            <span>
              <strong>Quer doar livros?</strong>
              Ofereça a doação a um sebo em Doar livros.
            </span>
          </button>
          <button className="contact-shortcut" type="button" onClick={onOpenOwner}>
            <Store size={18} />
            <span>
              <strong>Tem um sebo?</strong>
              Cadastre o estabelecimento em Meu sebo.
            </span>
          </button>
        </div>
      </aside>
    </div>
  )
}
