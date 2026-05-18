import { z } from 'zod'

export const createDriverProfileSchema = z.object({
  bio: z.string()
    .max(500, 'Bio não pode exceder 500 caracteres')
    .optional(),
  vehicleMake: z.string()
    .min(1, 'Marca do veículo é obrigatória'),
  vehicleModel: z.string()
    .min(1, 'Modelo do veículo é obrigatório'),
  vehicleYear: z.number()
    .int('Ano deve ser um número inteiro')
    .min(2000, 'Ano do veículo deve ser 2000 ou posterior')
    .max(2030, 'Ano do veículo não pode ser no futuro'),
  vehiclePlate: z.string()
    .regex(/^[A-Z]{3}-?\d{4}$/, 'Placa inválida (formato: ABC-1234)')
    .transform(p => p.replace('-', '').toUpperCase()),
  vehicleColor: z.string()
    .min(1, 'Cor do veículo é obrigatória'),
  vehicleCapacity: z.number()
    .int('Capacidade deve ser um número inteiro')
    .min(1, 'Capacidade deve ser pelo menos 1')
    .max(10, 'Capacidade máxima é 10'),
  licenseNumber: z.string()
    .min(1, 'Número da carteira é obrigatório'),
  licenseExpiry: z.string()
    .datetime('Data inválida')
    .refine((date) => new Date(date) > new Date(), 'Carteira deve estar válida'),
  baseRatePerKm: z.number()
    .positive('Taxa por km deve ser positiva')
    .max(100, 'Taxa por km muito alta'),
  baseRatePerHour: z.number()
    .positive('Taxa por hora deve ser positiva')
    .max(200, 'Taxa por hora muito alta'),
})

export const updateDriverProfileSchema = createDriverProfileSchema.partial()

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
  date: z.string()
    .optional(),
  capacity: z.string()
    .optional(),
  page: z.string()
    .optional(),
  limit: z.string()
    .optional(),
})

export type CreateDriverProfileInput = z.infer<typeof createDriverProfileSchema>
export type UpdateDriverProfileInput = z.infer<typeof updateDriverProfileSchema>
export type AvailabilityInput = z.infer<typeof availabilitySchema>
