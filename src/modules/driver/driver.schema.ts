import { z } from 'zod'

export const createDriverProfileSchema = z.object({
  // Passo 1 — dados pessoais (opcionais para permitir criação parcial)
  birthDate: z.string()
    .refine(v => !Number.isNaN(Date.parse(v)), { message: 'Data de nascimento inválida' })
    .optional(),
  address: z.string()
    .min(5, 'Endereço deve ter pelo menos 5 caracteres')
    .max(300, 'Endereço muito longo')
    .optional(),
  bio: z.string()
    .max(500, 'Bio não pode exceder 500 caracteres')
    .optional(),

  // Passo 2 — dados do veículo (opcionais para permitir criação em 2 etapas)
  vehicleMake: z.string()
    .min(1, 'Marca do veículo é obrigatória')
    .optional(),
  vehicleModel: z.string()
    .min(1, 'Modelo do veículo é obrigatório')
    .optional(),
  vehicleYear: z.number()
    .int('Ano deve ser um número inteiro')
    .min(new Date().getFullYear() - 5, `Veículo deve ter no máximo 5 anos`)
    .max(new Date().getFullYear(), 'Ano do veículo não pode ser no futuro')
    .optional(),
  vehiclePlate: z.string()
    .regex(/^[A-Z]{3}-?(\d{4}|\d[A-Z]\d{2})$/, 'Placa inválida (formato: ABC-1234 ou ABC-1D23)')
    .transform(p => p.toUpperCase())
    .optional(),
  vehicleColor: z.string()
    .min(1, 'Cor do veículo é obrigatória')
    .optional(),
  vehicleCapacity: z.number()
    .int('Capacidade deve ser um número inteiro')
    .min(1, 'Capacidade deve ser pelo menos 1')
    .max(10, 'Capacidade máxima é 10')
    .optional(),
  licenseNumber: z.string()
    .regex(/^\d{11}$/, 'Número da carteira deve ter 11 dígitos')
    .optional(),
  licenseExpiry: z.string()
    .datetime('Data inválida')
    .refine((date) => new Date(date) > new Date(), 'Carteira deve estar válida')
    .optional(),
  baseRatePerKm: z.number()
    .positive('Taxa por km deve ser positiva')
    .max(100, 'Taxa por km muito alta')
    .optional(),
  baseRatePerHour: z.number()
    .positive('Taxa por hora deve ser positiva')
    .max(200, 'Taxa por hora muito alta')
    .optional(),
})

export const updateDriverProfileSchema = createDriverProfileSchema

export const availabilitySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)')
    .refine((date) => date >= new Date().toISOString().split('T')[0], 'Data deve ser hoje ou no futuro'),
  startTime: z.string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  endTime: z.string()
    .regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:MM)'),
  isAvailable: z.boolean().default(true),
  note: z.string()
    .max(200, 'Nota não pode exceder 200 caracteres')
    .optional(),
}).refine((data) => {
  const [startH, startM] = data.startTime.split(':').map(Number)
  const [endH, endM] = data.endTime.split(':').map(Number)
  return startH * 60 + startM < endH * 60 + endM
}, {
  message: 'Hora de término deve ser posterior à hora de início',
  path: ['endTime'],
})

export const driverSearchSchema = z.object({
  date: z.string().optional(),
  capacity: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

export type CreateDriverProfileInput = z.infer<typeof createDriverProfileSchema>
export type UpdateDriverProfileInput = z.infer<typeof updateDriverProfileSchema>
export type AvailabilityInput = z.infer<typeof availabilitySchema>
