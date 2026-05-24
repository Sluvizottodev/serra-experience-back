import { z } from 'zod'

const optionalUrl = z
  .string()
  .max(500, 'Link não pode exceder 500 caracteres')
  .refine(v => v === '' || /^https?:\/\/.+/.test(v), { message: 'Link deve começar com http:// ou https://' })
  .optional()
  .nullable()

export const createPartnerSchema = z.object({
  name:        z.string().min(1, 'Nome é obrigatório').max(100, 'Nome não pode exceder 100 caracteres'),
  description: z.string().max(200, 'Descrição não pode exceder 200 caracteres').optional().nullable(),
  link:        optionalUrl,
  active:      z.boolean().optional().default(true),
  order:       z.number().int('Ordem deve ser inteiro').min(0).max(999).optional().default(0),
})

export const updatePartnerSchema = createPartnerSchema.partial()

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>
