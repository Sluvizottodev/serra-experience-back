import { z } from 'zod'
import { isValidCpf } from '../../common/utils/cpf'

export const updateUserSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome não pode exceder 100 caracteres')
    .optional(),
  phone: z.string()
    .regex(/^\d{10,11}$/, 'Telefone inválido (10 ou 11 dígitos)')
    .optional(),
  cpf: z.string()
    .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')
    .refine(isValidCpf, 'CPF inválido')
    .optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
