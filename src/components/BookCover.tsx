import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { BookRecord } from '../types'

export function BookCover({ book }: { book: BookRecord }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const ready = Boolean(
    book.coverUrl && loadedUrl === book.coverUrl && failedUrl !== book.coverUrl,
  )
  return (
    <div className="cover-art">
      {!ready && (
        <div className="cover-placeholder">
          <BookOpen size={30} aria-hidden="true" />
          <strong>{book.title}</strong>
          <small>{book.author}</small>
        </div>
      )}
      {book.coverUrl && failedUrl !== book.coverUrl && (
        <img
          src={book.coverUrl}
          alt={`Capa de ${book.title}`}
          loading="lazy"
          style={{ opacity: ready ? 1 : 0 }}
          onLoad={() => setLoadedUrl(book.coverUrl ?? null)}
          onError={() => setFailedUrl(book.coverUrl ?? null)}
        />
      )}
    </div>
  )
}
