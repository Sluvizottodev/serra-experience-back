import { z } from 'zod'

export const updateTripStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']),
})

export const cancelTripSchema = z.object({
  cancelReason: z.string().min(5),
})

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

export type UpdateTripStatusInput = z.infer<typeof updateTripStatusSchema>
export type CancelTripInput = z.infer<typeof cancelTripSchema>
export type ReviewInput = z.infer<typeof reviewSchema>
