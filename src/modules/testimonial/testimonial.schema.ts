import { z } from 'zod'

export const createTestimonialSchema = z.object({
  type:   z.enum(['TEXT', 'IMAGE']).optional(),
  name:   z.string().min(1).max(100),
  role:   z.string().max(80).optional(),
  text:   z.string().min(1).max(500).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  active: z.boolean().optional(),
  order:  z.number().int().min(0).max(999).optional(),
}).refine(
  (data) => data.type === 'IMAGE' || (data.text != null && data.text.trim().length > 0),
  { message: 'Depoimento de texto exige o campo "text"', path: ['text'] },
)

export const updateTestimonialSchema = z.object({
  type:   z.enum(['TEXT', 'IMAGE']).optional(),
  name:   z.string().min(1).max(100).optional(),
  role:   z.string().max(80).optional(),
  text:   z.string().min(1).max(500).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  active: z.boolean().optional(),
  order:  z.number().int().min(0).max(999).optional(),
})
