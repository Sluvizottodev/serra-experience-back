import { z } from 'zod'

export const createQuoteSchema = z.object({
  driverProfileId: z.string().uuid().optional(),
  originAddress: z.string()
    .min(5, 'Endereço de origem deve ter pelo menos 5 caracteres'),
  destinationAddress: z.string()
    .min(5, 'Endereço de destino deve ter pelo menos 5 caracteres'),
  scheduledAt: z.string()
    .datetime('Data e hora inválida')
    .refine(d => new Date(d) > new Date(), 'A data da viagem deve ser no futuro'),
  passengerCount: z.number()
    .int('Número de passageiros deve ser um número inteiro')
    .min(1, 'Deve ter pelo menos 1 passageiro')
    .max(10, 'Máximo de 10 passageiros permitido')
    .default(1),
  notes: z.string()
    .max(500, 'Notas não podem exceder 500 caracteres')
    .optional(),
})

export const respondQuoteSchema = z.object({
  responsePrice: z.number()
    .positive('Preço deve ser positivo'),
  responseNote: z.string()
    .max(200, 'Nota não pode exceder 200 caracteres')
    .optional(),
})

export const previewQuoteSchema = z.object({
  originAddress: z.string()
    .min(5, 'Endereço de origem deve ter pelo menos 5 caracteres'),
  destinationAddress: z.string()
    .min(5, 'Endereço de destino deve ter pelo menos 5 caracteres'),
  scheduledAt: z.string()
    .datetime('Data e hora inválida')
    .refine(d => new Date(d) > new Date(), 'A data da viagem deve ser no futuro'),
  vehicleType: z.enum(['sedan', 'suv', 'van', 'executivo'], {
    errorMap: () => ({ message: 'Tipo de veículo inválido' }),
  }).optional(),
})

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type RespondQuoteInput = z.infer<typeof respondQuoteSchema>
export type PreviewQuoteInput = z.infer<typeof previewQuoteSchema>
