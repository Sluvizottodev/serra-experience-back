import { z } from 'zod'

const optionalUrl = z
  .string()
  .max(500, 'Link não pode exceder 500 caracteres')
  .refine(v => v === '' || /^https?:\/\/.+/.test(v), { message: 'Link deve começar com http:// ou https://' })
  .optional()
  .nullable()

export const createEventSchema = z.object({
  title:       z.string().min(1, 'Título é obrigatório').max(100, 'Título não pode exceder 100 caracteres'),
  description: z.string().max(500, 'Descrição não pode exceder 500 caracteres').optional().nullable(),
  date:        z.string().max(50, 'Data inválida').optional().nullable(),
  location:    z.string().max(150, 'Local não pode exceder 150 caracteres').optional().nullable(),
  link:        optionalUrl,
  featured:    z.boolean().optional().default(false),
  active:      z.boolean().optional().default(true),
  order:       z.number().int('Ordem deve ser inteiro').min(0).max(999).optional().default(0),
})

export const updateEventSchema = createEventSchema.partial()

export type CreateEventInput = z.infer<typeof createEventSchema>
export type UpdateEventInput = z.infer<typeof updateEventSchema>
