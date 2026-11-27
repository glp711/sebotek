import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { friendlyErrorMessage } from '../lib/friendlyErrors'

type Pickup = {
  id: string
  title: string
  store_name: string
  condition: string
  notes: string
  price: number
  status: string
}
const grades: Record<string, string> = {
  NEW: 'Novo',
  LIKE_NEW: 'Seminovo',
  GOOD: 'Bom',
  FAIR: 'Regular',
  POOR: 'Gasto',
}
const states: Record<string, string> = {
  RESERVED: 'Aguardando retirada',
  COLLECTED: 'Retirado',
  CANCELLED: 'Cancelado',
}

export function Pickups({
  storeId,
  readerId,
  onChange,
}: {
  storeId?: string
  readerId?: string
  onChange: () => void
}) {
  const [rows, setRows] = useState<Pickup[]>([])
  const [demand, setDemand] = useState<{ title: string; readers: number }[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('pickups')
      .select('id,title,store_name,condition,notes,price,status')
      .eq(storeId ? 'store_id' : 'reader_id', storeId ?? readerId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    setRows(data ?? [])
    setLoaded(true)
    if (storeId) {
      const result = await supabase.rpc('reader_demand')
      if (result.error) throw result.error
      setDemand(result.data ?? [])
    }
  }, [storeId, readerId])
  useEffect(() => {
    void Promise.resolve()
      .then(load)
      .catch((e) => setMessage(friendlyErrorMessage(e)))
  }, [load])
  async function finish(id: string, status: string) {
    if (!supabase || busy) return
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase
        .from('pickups')
        .update({ status })
        .eq('id', id)
        .eq('status', 'RESERVED')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data)
        setMessage('Esta reserva já mudou. Confira a lista atualizada.')
      await load()
      onChange()
    } catch (e) {
      setMessage(friendlyErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="owner-card pickup-list">
      <h3>{storeId ? 'Reservas para retirada' : 'Minhas reservas'}</h3>
      {loaded && !rows.length && <p>Nenhuma reserva por enquanto.</p>}
      {rows.map((r) => (
        <article key={r.id}>
          <strong>{r.title}</strong>
          <p>
            {r.store_name} · {grades[r.condition]} ·{' '}
            {Number(r.price).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </p>
          {r.notes && <p>{r.notes}</p>}
          <p>
            {states[r.status]} · Reserva {r.id.slice(0, 8)}
          </p>
          {r.status === 'RESERVED' && (
            <div className="dialog-actions">
              {storeId && (
                <button
                  disabled={busy}
                  className="primary-action"
                  onClick={() => void finish(r.id, 'COLLECTED')}
                >
                  Confirmar retirada
                </button>
              )}
              <button
                disabled={busy}
                className="secondary-action"
                onClick={() => void finish(r.id, 'CANCELLED')}
              >
                Cancelar reserva
              </button>
            </div>
          )}
        </article>
      ))}
      {storeId && (
        <>
          <h3>Livros procurados pelos leitores</h3>
          {demand.length
            ? demand.map((d) => (
                <p key={d.title}>
                  {d.title} · {d.readers}{' '}
                  {d.readers === 1 ? 'leitor' : 'leitores'}
                </p>
              ))
            : loaded && <p>Nenhum título para mostrar.</p>}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  )
}
