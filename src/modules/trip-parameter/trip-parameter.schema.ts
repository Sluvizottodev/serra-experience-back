import { z } from 'zod'

const conditionOpEnum = z.enum([
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'EQUALS',
  'NOT_EQUALS',
])

const baseParameterSchema = z.object({
  name:            z.string().min(1, 'Nome é obrigatório').max(100, 'Nome não pode exceder 100 caracteres'),
  description:     z.string().max(300, 'Descrição não pode exceder 300 caracteres').optional().nullable(),
  conditionType:   z.enum(['DISTANCE_FROM_BASE_KM', 'TRIP_TOTAL_KM', 'HAS_RETURN', 'VEHICLE_TYPE', 'DEPARTURE_HOUR']),
  conditionOp:     conditionOpEnum.optional().nullable(),
  conditionValue:  z.number().optional().nullable(),
  conditionValue2: z.number().optional().nullable(),
  conditionExtra:  z.string().max(100).optional().nullable(),
  action:          z.enum(['ADD_CHARGE', 'REQUIRE_WHATSAPP']).default('ADD_CHARGE'),
  chargeType:      z.enum(['PERCENTAGE', 'PER_KM_EXTRA']).optional().nullable(),
  chargeValue:     z.number().min(0, 'Valor deve ser positivo').optional().nullable(),
  appliesTo:       z.enum(['TRIPS', 'EVENTS', 'BOTH']).default('TRIPS'),
  appliesForQuotes:  z.boolean().default(true),
  appliesForDirect:  z.boolean().default(true),
  active: z.boolean().default(true),
  order:  z.number().int('Ordem deve ser inteiro').min(0).max(999).default(0),
})

function addCrossFieldRules<T extends typeof baseParameterSchema>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const needsOp = ['DISTANCE_FROM_BASE_KM', 'TRIP_TOTAL_KM'].includes(data.conditionType)
    if (needsOp && !data.conditionOp) {
      ctx.addIssue({ code: 'custom', path: ['conditionOp'], message: 'Operador é obrigatório para este tipo de condição' })
    }
    if (needsOp && data.conditionValue == null) {
      ctx.addIssue({ code: 'custom', path: ['conditionValue'], message: 'Valor é obrigatório para este tipo de condição' })
    }
    if (data.conditionType === 'HAS_RETURN' && !data.conditionExtra) {
      ctx.addIssue({ code: 'custom', path: ['conditionExtra'], message: 'Informe se a condição é com ou sem retorno' })
    }
    if (data.conditionType === 'VEHICLE_TYPE' && !data.conditionExtra) {
      ctx.addIssue({ code: 'custom', path: ['conditionExtra'], message: 'Informe o tipo de veículo' })
    }
    if (data.conditionType === 'DEPARTURE_HOUR' && data.conditionValue == null) {
      ctx.addIssue({ code: 'custom', path: ['conditionValue'], message: 'Informe a hora inicial' })
    }
    if (data.action === 'ADD_CHARGE') {
      if (!data.chargeType) {
        ctx.addIssue({ code: 'custom', path: ['chargeType'], message: 'Tipo de cobrança é obrigatório' })
      }
      if (data.chargeValue == null) {
        ctx.addIssue({ code: 'custom', path: ['chargeValue'], message: 'Valor da cobrança é obrigatório' })
      }
    }
  })
}

export const createParameterSchema = addCrossFieldRules(baseParameterSchema)
export const updateParameterSchema  = addCrossFieldRules(baseParameterSchema.partial() as any)

export type CreateParameterInput = z.infer<typeof baseParameterSchema>
export type UpdateParameterInput = Partial<CreateParameterInput>
