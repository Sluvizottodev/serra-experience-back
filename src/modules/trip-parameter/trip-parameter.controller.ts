import { Request, Response } from 'express'
import { TripParameterService } from './trip-parameter.service'

const service = new TripParameterService()

export class TripParameterController {
  async list(_req: Request, res: Response) {
    const params = await service.list()
    res.json(params)
  }

  async listActive(_req: Request, res: Response) {
    const params = await service.listActive()
    res.json(params)
  }

  async getById(req: Request, res: Response) {
    const param = await service.findById(Number(req.params.id))
    res.json(param)
  }

  async create(req: Request, res: Response) {
    const {
      name, description,
      conditionType, conditionOp, conditionValue, conditionValue2, conditionExtra,
      action, chargeType, chargeValue,
      appliesTo, appliesForQuotes, appliesForDirect,
      active, order,
    } = req.body

    const param = await service.create({
      name:            name.trim(),
      description:     description?.trim() || null,
      conditionType,
      conditionOp:     conditionOp || null,
      conditionValue:  conditionValue != null ? Number(conditionValue) : null,
      conditionValue2: conditionValue2 != null ? Number(conditionValue2) : null,
      conditionExtra:  conditionExtra?.trim() || null,
      action:          action ?? 'ADD_CHARGE',
      chargeType:      chargeType || null,
      chargeValue:     chargeValue != null ? Number(chargeValue) : null,
      appliesTo:       appliesTo ?? 'TRIPS',
      appliesForQuotes: appliesForQuotes !== false,
      appliesForDirect: appliesForDirect !== false,
      active:          active !== false,
      order:           Number(order) || 0,
    })
    res.status(201).json(param)
  }

  async update(req: Request, res: Response) {
    const {
      name, description,
      conditionType, conditionOp, conditionValue, conditionValue2, conditionExtra,
      action, chargeType, chargeValue,
      appliesTo, appliesForQuotes, appliesForDirect,
      active, order,
    } = req.body

    const data: Record<string, unknown> = {}
    if (name        !== undefined) data.name            = name.trim()
    if (description !== undefined) data.description     = description?.trim() || null
    if (conditionType  !== undefined) data.conditionType  = conditionType
    if (conditionOp    !== undefined) data.conditionOp    = conditionOp || null
    if (conditionValue  !== undefined) data.conditionValue  = conditionValue != null ? Number(conditionValue) : null
    if (conditionValue2 !== undefined) data.conditionValue2 = conditionValue2 != null ? Number(conditionValue2) : null
    if (conditionExtra  !== undefined) data.conditionExtra  = conditionExtra?.trim() || null
    if (action      !== undefined) data.action          = action
    if (chargeType  !== undefined) data.chargeType      = chargeType || null
    if (chargeValue !== undefined) data.chargeValue     = chargeValue != null ? Number(chargeValue) : null
    if (appliesTo   !== undefined) data.appliesTo       = appliesTo
    if (appliesForQuotes !== undefined) data.appliesForQuotes = appliesForQuotes
    if (appliesForDirect !== undefined) data.appliesForDirect = appliesForDirect
    if (active      !== undefined) data.active          = active
    if (order       !== undefined) data.order           = Number(order) || 0

    const param = await service.update(Number(req.params.id), data as any)
    res.json(param)
  }

  async remove(req: Request, res: Response) {
    await service.delete(Number(req.params.id))
    res.status(204).send()
  }

  async evaluate(req: Request, res: Response) {
    const {
      distanceTotalKm, distanceFromBaseKm, originAddress,
      hasReturn, vehicleType, departureHour,
      basePrice, target, isQuote,
    } = req.body

    const result = await service.evaluate({
      distanceTotalKm:    distanceTotalKm    != null ? Number(distanceTotalKm)    : undefined,
      distanceFromBaseKm: distanceFromBaseKm != null ? Number(distanceFromBaseKm) : undefined,
      originAddress:      originAddress ? String(originAddress) : undefined,
      hasReturn:          typeof hasReturn === 'boolean' ? hasReturn : undefined,
      vehicleType:        vehicleType ? String(vehicleType) : undefined,
      departureHour:      departureHour != null ? Number(departureHour) : undefined,
      basePrice:          basePrice != null ? Number(basePrice) : undefined,
      target:             target ?? 'TRIPS',
      isQuote:            typeof isQuote === 'boolean' ? isQuote : undefined,
    })
    res.json(result)
  }
}
