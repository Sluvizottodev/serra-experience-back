import { z } from 'zod'

export const createInfluencerSchema = z.object({
  name:   z.string().min(1, 'Nome é obrigatório').max(100, 'Nome não pode exceder 100 caracteres'),
  handle: z.string().max(60, 'Apelido não pode exceder 60 caracteres').optional().nullable(),
  notes:  z.string().max(300, 'Observações não podem exceder 300 caracteres').optional().nullable(),
  active: z.boolean().optional().default(true),
})

export const updateInfluencerSchema = createInfluencerSchema.partial()

export const createLinkSchema = z.object({
  eventId: z.string().uuid('Evento inválido'),
  code: z
    .string()
    .min(3, 'Código deve ter ao menos 3 caracteres')
    .max(80, 'Código não pode exceder 80 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Código deve conter apenas letras minúsculas, números e hífens')
    .optional(),
})

export const trackSchema = z.object({
  code: z.string().min(1).max(80),
  visitorId: z.string().max(100).optional(),
})

export type CreateInfluencerInput = z.infer<typeof createInfluencerSchema>
export type UpdateInfluencerInput = z.infer<typeof updateInfluencerSchema>
export type CreateLinkInput = z.infer<typeof createLinkSchema>
export type TrackInput = z.infer<typeof trackSchema>
