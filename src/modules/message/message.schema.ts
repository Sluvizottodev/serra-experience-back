import { z } from 'zod'

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'A mensagem não pode estar vazia').max(2000, 'Mensagem não pode exceder 2000 caracteres'),
})

export const getMessagesSchema = z.object({
  quoteId: z.string().uuid('ID do orçamento inválido'),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>
