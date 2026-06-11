import { z } from 'zod'

export const updateTripStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  cancelReason: z.string().min(5).max(500).optional(),
})

export const cancelTripSchema = z.object({
  cancelReason: z
    .string()
    .min(5, 'Motivo deve ter pelo menos 5 caracteres')
    .max(500, 'Motivo não pode exceder 500 caracteres'),
})

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Mínimo 1 estrela').max(5, 'Máximo 5 estrelas'),
  comment: z.string().max(500, 'Comentário não pode exceder 500 caracteres').optional(),
})

export type UpdateTripStatusInput = z.infer<typeof updateTripStatusSchema>
export type CancelTripInput = z.infer<typeof cancelTripSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
