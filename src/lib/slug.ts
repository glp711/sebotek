// Gera o "slug" (identificador legível usado em URLs) de um sebo.
// Ex.: "Sebo São José & Cia" -> "sebo-sao-jose-cia"

export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'sebo'

// Acrescenta um sufixo curto quando o slug base já está em uso por outro sebo.
export const slugWithSuffix = (base: string, random = Math.random) => {
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, '0')
  return `${slugify(base)}-${suffix}`
}

export const isSlugConflict = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const { code, message, details } = error as Record<string, unknown>
  const text = `${String(message ?? '')} ${String(details ?? '')}`
  return code === '23505' && text.includes('slug')
}
