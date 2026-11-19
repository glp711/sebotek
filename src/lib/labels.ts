import type { ContactTopic, DonationDelivery, DonationStatus } from '../types'

export const donationStatusLabel: Record<DonationStatus, string> = {
  PENDING: 'Aguardando o sebo',
  ACCEPTED: 'Aceita',
  DECLINED: 'Recusada',
  RECEIVED: 'Recebida',
  CANCELLED: 'Cancelada',
}

export const donationDeliveryLabel: Record<DonationDelivery, string> = {
  DROP_OFF: 'Levo até o sebo',
  PICKUP: 'Preciso de retirada',
}

export const contactTopicLabel: Record<ContactTopic, string> = {
  DUVIDA: 'Dúvida sobre o site',
  SEBO: 'Quero cadastrar meu sebo',
  DOACAO: 'Doação de livros',
  PROBLEMA: 'Problema ou erro',
  SUGESTAO: 'Sugestão',
}

export const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : ''
