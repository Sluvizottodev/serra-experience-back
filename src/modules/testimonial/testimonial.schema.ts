import { z } from 'zod'

export const createTestimonialSchema = z.object({
  name:   z.string().min(1).max(100),
  role:   z.string().max(80).optional(),
  text:   z.string().min(1).max(500),
  rating: z.number().int().min(1).max(5).optional(),
  active: z.boolean().optional(),
  order:  z.number().int().min(0).max(999).optional(),
})

export const updateTestimonialSchema = createTestimonialSchema.partial()
