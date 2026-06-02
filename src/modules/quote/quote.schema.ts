import { z } from 'zod'

// Endereço humano: rua, número, bairro, cidade — sem coordenadas
// Regex bloqueia strings que parecem lat/lng puras (ex: "-23.5505, -46.6333")
const LATLNG_RE = /^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/

const addressField = (label: string) =>
  z.string()
    .min(10, `${label} deve ter pelo menos 10 caracteres`)
    .max(200, `${label} não pode exceder 200 caracteres`)
    .refine(v => !LATLNG_RE.test(v.trim()), {
      message: `${label} deve ser um endereço por extenso, não coordenadas`,
    })
    .transform(v => v.trim())

export const createQuoteSchema = z.object({
  driverProfileId: z.string().uuid().optional(),
  originAddress: addressField('Endereço de origem'),
  destinationAddress: addressField('Endereço de destino'),
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
    .positive('Preço deve ser positivo')
    .max(99_999.99, 'Valor fora do limite permitido'),
  responseNote: z.string()
    .max(200, 'Nota não pode exceder 200 caracteres')
    .optional(),
})

export const previewQuoteSchema = z.object({
  originAddress: addressField('Endereço de origem'),
  destinationAddress: addressField('Endereço de destino'),
  scheduledAt: z.string()
    .datetime('Data e hora inválida')
    .refine(d => new Date(d) > new Date(), 'A data da viagem deve ser no futuro'),
  vehicleType: z.enum(['sedan', 'suv', 'van', 'executivo'], {
    errorMap: () => ({ message: 'Tipo de veículo inválido' }),
  }).optional(),
})

export const createGuestQuoteSchema = z.object({
  guestName: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome não pode exceder 100 caracteres'),
  guestPhone: z.string()
    .regex(/^\d{10,11}$/, 'Telefone inválido (10 ou 11 dígitos)'),
  originAddress: addressField('Endereço de origem'),
  destinationAddress: addressField('Endereço de destino'),
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
  driverIds: z.array(z.string().uuid()).optional(),
})

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>
export type CreateGuestQuoteInput = z.infer<typeof createGuestQuoteSchema>
export type RespondQuoteInput = z.infer<typeof respondQuoteSchema>
export type PreviewQuoteInput = z.infer<typeof previewQuoteSchema>
