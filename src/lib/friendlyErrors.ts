// Traduz erros técnicos (Supabase Auth, PostgREST/Postgres e rede) em
// mensagens claras em português. Mantém a mensagem original apenas quando ela
// não é reconhecida, para não esconder informações úteis durante a depuração.

type ErrorLike = {
  message?: unknown
  code?: unknown
  details?: unknown
  name?: unknown
}

const DEFAULT_FALLBACK = 'Não foi possível concluir a ação.'

const readError = (error: unknown) => {
  if (typeof error === 'string') {
    return { message: error, code: '', details: '', name: '' }
  }
  if (!error || typeof error !== 'object') return null
  const candidate = error as ErrorLike
  return {
    message: typeof candidate.message === 'string' ? candidate.message : '',
    code: typeof candidate.code === 'string' ? candidate.code : '',
    details: typeof candidate.details === 'string' ? candidate.details : '',
    name: typeof candidate.name === 'string' ? candidate.name : '',
  }
}

export function friendlyErrorMessage(
  error: unknown,
  fallback = DEFAULT_FALLBACK,
): string {
  const parsed = readError(error)
  if (!parsed || (!parsed.message && !parsed.code)) return fallback

  const { code, name } = parsed
  const message = parsed.message.toLowerCase()
  const context = `${message} ${parsed.details.toLowerCase()}`

  // Autenticação (Supabase Auth)
  if (message.includes('rate limit')) {
    return 'O envio de e-mails está temporariamente indisponível por excesso de solicitações. Aguarde alguns minutos antes de tentar novamente. Se sua conta já foi confirmada, você pode entrar normalmente.'
  }
  if (message.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (message.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.'
  }
  if (message.includes('user already registered')) {
    return 'Este e-mail já está cadastrado. Entre na sua conta ou recupere a senha.'
  }
  if (message.includes('password should be at least')) {
    return 'A senha é muito curta. Use pelo menos 6 caracteres.'
  }
  if (
    message.includes('new password should be different') ||
    message.includes('same_password')
  ) {
    return 'A nova senha precisa ser diferente da senha atual.'
  }
  if (message.includes('token has expired') || message.includes('otp_expired')) {
    return 'O código expirou. Solicite um novo código e tente novamente.'
  }
  if (message.includes('invalid token') || message.includes('token is invalid')) {
    return 'Código inválido. Confira o código completo enviado por e-mail e use sempre o mais recente.'
  }
  if (
    message.includes('provider is not enabled') ||
    message.includes('unsupported provider')
  ) {
    return 'O login com Google ainda precisa ser ativado no painel do Supabase.'
  }

  // Banco de dados (códigos SQLSTATE do Postgres repassados pelo PostgREST)
  if (code === '23505' || message.includes('duplicate key')) {
    if (context.includes('stores_owner_id_key') || context.includes('owner_id')) {
      return 'Esta conta já possui um sebo cadastrado. Cada responsável pode cadastrar apenas um sebo.'
    }
    if (context.includes('stores_slug_key') || context.includes('slug')) {
      return 'Já existe um sebo com esse nome. Acrescente o bairro ou a cidade ao nome e tente novamente.'
    }
    return 'Este registro já existe.'
  }
  if (code === '42501' || message.includes('row-level security')) {
    return 'Você não tem permissão para esta ação. Confira se entrou com a conta correta e se o sebo já foi aprovado pela administração.'
  }
  if (code === '23514' || message.includes('violates check constraint')) {
    return 'Algum campo está com um valor inválido. Confira tamanhos, preço, quantidade, ano, ISBN, UF e telefone.'
  }
  if (code === '22P02' || message.includes('invalid input syntax')) {
    return 'Algum campo numérico está em um formato inválido. Use apenas números em preço, quantidade e ano.'
  }
  if (code === '23502' || message.includes('null value in column')) {
    return 'Preencha todos os campos obrigatórios.'
  }
  if (code === 'PGRST301' || message.includes('jwt expired')) {
    return 'Sua sessão expirou. Entre novamente na sua conta.'
  }

  // Rede
  if (name === 'TimeoutError' || name === 'AbortError' || message.includes('timed out')) {
    return 'O servidor demorou para responder. Verifique sua conexão e tente novamente.'
  }
  if (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  ) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.'
  }

  return parsed.message || fallback
}
