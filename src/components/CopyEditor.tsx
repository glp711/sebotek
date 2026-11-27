import { useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { friendlyErrorMessage } from '../lib/friendlyErrors'
import type { BookDraft } from '../types'

export function CopyEditor({
  draft,
  onChange,
  onBusy,
}: {
  draft: BookDraft
  onChange: (draft: BookDraft) => void
  onBusy: (busy: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function upload(file?: File) {
    if (!file || busy || !supabase) return
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError('Escolha uma foto JPG, PNG ou WebP de até 5 MB.')
      return
    }
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) throw new Error('Entre na sua conta.')
      const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('book-covers')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      const { data } = supabase.storage.from('book-covers').getPublicUrl(path)
      onChange({
        ...draft,
        copyPhotos: [...(draft.copyPhotos ?? []), data.publicUrl],
      })
    } catch (e) {
      setError(friendlyErrorMessage(e))
    } finally {
      setBusy(false)
      onBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <fieldset className="copy-editor" disabled={busy}>
      <legend>Conservação do exemplar</legend>
      <label>
        Marcas de uso e detalhes
        <textarea
          maxLength={500}
          value={draft.conditionNotes ?? ''}
          onChange={(e) =>
            onChange({ ...draft, conditionNotes: e.target.value })
          }
          placeholder="Ex.: páginas amareladas, dedicatória na primeira página, sem rasgos."
        />
      </label>
      <div className="copy-photo-list">
        {draft.copyPhotos?.map((url, i) => (
          <div key={url}>
            <img src={url} alt={`Foto ${i + 1} do exemplar`} />
            <button
              type="button"
              className="icon-button"
              title="Remover foto"
              onClick={() =>
                onChange({
                  ...draft,
                  copyPhotos: draft.copyPhotos?.filter((p) => p !== url),
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy || (draft.copyPhotos?.length ?? 0) >= 3}
        className="secondary-action"
        onClick={() => input.current?.click()}
      >
        <Upload size={16} />
        {busy ? 'Enviando foto…' : 'Adicionar foto real'}
      </button>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  )
}
