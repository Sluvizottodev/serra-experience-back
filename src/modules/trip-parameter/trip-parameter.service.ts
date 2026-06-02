import axios from 'axios'
import { prisma } from '../../common/config/prisma'
import type {
  ConditionType,
  ConditionOperator,
  ParameterTarget,
  TripParameter,
} from '@prisma/client'

export interface EvaluationInput {
  distanceTotalKm?: number
  distanceFromBaseKm?: number
  originAddress?: string
  hasReturn?: boolean
  vehicleType?: string
  departureHour?: number
  basePrice?: number
  target?: 'TRIPS' | 'EVENTS'
  isQuote?: boolean
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: address, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'viagem-motorista/1.0' },
      timeout: 4000,
    })
    const hit = res.data?.[0]
    if (!hit) return null
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) }
  } catch {
    return null
  }
}

export interface ParameterCharge {
  parameterId: number
  name: string
  chargeType: 'PERCENTAGE' | 'PER_KM_EXTRA'
  chargeValue: number
  amount: number
}

export interface EvaluationResult {
  requiresWhatsapp: boolean
  whatsappReasons: string[]
  charges: ParameterCharge[]
  totalExtraAmount: number
}

function applyOperator(value: number, op: ConditionOperator, threshold: number): boolean {
  switch (op) {
    case 'GREATER_THAN':           return value > threshold
    case 'GREATER_THAN_OR_EQUAL':  return value >= threshold
    case 'LESS_THAN':              return value < threshold
    case 'LESS_THAN_OR_EQUAL':     return value <= threshold
    case 'EQUALS':                 return value === threshold
    case 'NOT_EQUALS':             return value !== threshold
  }
}

function evaluateCondition(param: TripParameter, input: EvaluationInput): boolean {
  const type = param.conditionType as ConditionType

  switch (type) {
    case 'DISTANCE_FROM_BASE_KM': {
      if (input.distanceFromBaseKm == null || !param.conditionOp || param.conditionValue == null) return false
      return applyOperator(input.distanceFromBaseKm, param.conditionOp as ConditionOperator, Number(param.conditionValue))
    }
    case 'TRIP_TOTAL_KM': {
      if (input.distanceTotalKm == null || !param.conditionOp || param.conditionValue == null) return false
      return applyOperator(input.distanceTotalKm, param.conditionOp as ConditionOperator, Number(param.conditionValue))
    }
    case 'HAS_RETURN': {
      const expected = param.conditionExtra === 'true'
      return input.hasReturn === expected
    }
    case 'VEHICLE_TYPE': {
      if (!input.vehicleType || !param.conditionExtra) return false
      const match = input.vehicleType.toLowerCase().trim() === param.conditionExtra.toLowerCase().trim()
      return param.conditionOp === 'NOT_EQUALS' ? !match : match
    }
    case 'DEPARTURE_HOUR': {
      if (input.departureHour == null || param.conditionValue == null) return false
      const start = Number(param.conditionValue)
      const end   = param.conditionValue2 != null ? Number(param.conditionValue2) : (start + 1)
      const h     = input.departureHour
      if (start <= end) return h >= start && h < end
      return h >= start || h < end
    }
    default:
      return false
  }
}

function appliesToTarget(param: TripParameter, target: 'TRIPS' | 'EVENTS'): boolean {
  const t = param.appliesTo as ParameterTarget
  if (t === 'BOTH') return true
  return t === target
}

export class TripParameterService {
  async list() {
    return prisma.tripParameter.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async findById(id: number) {
    const param = await prisma.tripParameter.findUnique({ where: { id } })
    if (!param) throw Object.assign(new Error('Parâmetro não encontrado'), { statusCode: 404 })
    return param
  }

  async create(data: {
    name: string
    description?: string | null
    conditionType: string
    conditionOp?: string | null
    conditionValue?: number | null
    conditionValue2?: number | null
    conditionExtra?: string | null
    action: string
    chargeType?: string | null
    chargeValue?: number | null
    appliesTo: string
    appliesForQuotes: boolean
    appliesForDirect: boolean
    active: boolean
    order: number
  }) {
    return prisma.tripParameter.create({ data: data as any })
  }

  async update(id: number, data: Partial<{
    name: string
    description: string | null
    conditionType: string
    conditionOp: string | null
    conditionValue: number | null
    conditionValue2: number | null
    conditionExtra: string | null
    action: string
    chargeType: string | null
    chargeValue: number | null
    appliesTo: string
    appliesForQuotes: boolean
    appliesForDirect: boolean
    active: boolean
    order: number
  }>) {
    await this.findById(id)
    return prisma.tripParameter.update({ where: { id }, data: data as any })
  }

  async delete(id: number) {
    await this.findById(id)
    return prisma.tripParameter.delete({ where: { id } })
  }

  async listActive() {
    return prisma.tripParameter.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    const target = input.target ?? 'TRIPS'
    const params = await this.listActive()

    const applicable = params.filter(p => {
      if (!appliesToTarget(p, target)) return false
      if (input.isQuote === true  && !p.appliesForQuotes)  return false
      if (input.isQuote === false && !p.appliesForDirect)  return false
      return true
    })

    const result: EvaluationResult = {
      requiresWhatsapp: false,
      whatsappReasons: [],
      charges: [],
      totalExtraAmount: 0,
    }

    for (const param of applicable) {
      if (!evaluateCondition(param, input)) continue

      if (param.action === 'REQUIRE_WHATSAPP') {
        result.requiresWhatsapp = true
        result.whatsappReasons.push(param.name)
        continue
      }

      if (param.action === 'ADD_CHARGE' && param.chargeType && param.chargeValue != null) {
        const val   = Number(param.chargeValue)
        let amount  = 0

        if (param.chargeType === 'PERCENTAGE' && input.basePrice != null) {
          amount = input.basePrice * (val / 100)
        } else if (param.chargeType === 'PER_KM_EXTRA') {
          const km = input.distanceTotalKm ?? 0
          const threshold = param.conditionValue != null ? Number(param.conditionValue) : 0
          const extraKm   = Math.max(0, km - threshold)
          amount = extraKm * val
        }

        result.charges.push({
          parameterId: param.id,
          name:        param.name,
          chargeType:  param.chargeType as 'PERCENTAGE' | 'PER_KM_EXTRA',
          chargeValue: val,
          amount,
        })
        result.totalExtraAmount += amount
      }
    }

    return result
  }
}
