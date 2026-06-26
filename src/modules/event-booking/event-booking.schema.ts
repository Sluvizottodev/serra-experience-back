import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD)')

export const upsertDateSlotsSchema = z.object({
  slots: z.array(z.object({
    date: isoDate,
    capacity: z.number().int('Capacidade deve ser um número inteiro').min(0).max(9999),
  })).max(366, 'Período do evento é muito longo'),
})

export const createBookingSchema = z.object({
  dates: z.array(isoDate).min(1, 'Selecione ao menos uma data'),
  passengerCount: z.number()
    .int('Número de passageiros deve ser um número inteiro')
    .min(1, 'Deve ter pelo menos 1 passageiro')
    .max(10, 'Máximo de 10 passageiros permitido')
    .default(1),
  userId: z.string().uuid().optional(),
  guestName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).optional(),
  guestPhone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido (10 ou 11 dígitos)').optional(),
  notes: z.string().max(500, 'Notas não podem exceder 500 caracteres').optional(),
}).refine(data => data.userId || (data.guestName && data.guestPhone), {
  message: 'Informe um usuário ou nome e telefone do cliente',
  path: ['guestName'],
})

export type UpsertDateSlotsInput = z.infer<typeof upsertDateSlotsSchema>
export type CreateBookingInput = z.infer<typeof createBookingSchema>
