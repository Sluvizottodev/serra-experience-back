import { prisma } from '../../common/config/prisma'
import { AppError } from '../../common/middlewares/error.middleware'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import { getRouteDistance } from '../../common/utils/geo'
import { generateSecureToken } from '../../common/utils/otp'
import { isLicenseExpired, LICENSE_EXPIRED_MESSAGE } from '../../common/utils/license'
import { env } from '../../common/config/env'
import { tplViagemConfirmadaPassageiro } from '../../common/utils/email.templates'
import { enqueueNotification } from '../../common/config/queue'
import type { CreateQuoteInput, CreateGuestQuoteInput, RespondQuoteInput, PreviewQuoteInput } from './quote.schema'

// Fallback caso a configuração não esteja definida nas Settings
const DEFAULT_ASSIGN_EXPIRY_HOURS = 24

const QUOTE_EXPIRY_HOURS = 48

export class QuoteService {
  async createQuote(passengerId: string, data: CreateQuoteInput) {
    const expiresAt = new Date(Date.now() + QUOTE_EXPIRY_HOURS * 60 * 60 * 1000)
    return prisma.quote.create({
      data: {
        ...data,
        passengerId,
        scheduledAt: new Date(data.scheduledAt),
        expiresAt,
      },
    })
  }

  async createGuestQuote(data: CreateGuestQuoteInput) {
    const expiresAt = new Date(Date.now() + QUOTE_EXPIRY_HOURS * 60 * 60 * 1000)
    const { guestName, guestPhone, ...quoteData } = data

    return prisma.quote.create({
      data: {
        ...quoteData,
        guestName,
        guestPhone,
        scheduledAt: new Date(quoteData.scheduledAt),
        expiresAt,
      },
    })
  }

  async getMyQuotes(passengerId: string, page = 1, limit = 10) {
    const { take, skip } = getPaginationParams(page, limit)
    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where: { passengerId },
        include: {
          driverProfile: {
            select: {
              id: true,
              vehicleMake: true,
              vehicleModel: true,
              user: { select: { name: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.quote.count({ where: { passengerId } }),
    ])
    return { quotes, meta: buildPaginationMeta(total, page, take) }
  }

  async getQuote(id: string, userId: string) {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        passenger: { select: { id: true, name: true, phone: true, avatarUrl: true } },
        driverProfile: {
          select: {
            id: true,
            vehicleMake: true,
            vehicleModel: true,
            vehiclePlate: true,
            user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
          },
        },
      },
    })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')
    if (quote.passengerId !== userId && quote.driverProfile?.user.id !== userId) {
      throw new AppError(403, 'Você não tem acesso a este orçamento')
    }
    return quote
  }

  async getDriverQuotes(userId: string, page = 1, limit = 10) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const { take, skip } = getPaginationParams(page, limit)
    const where = { driverProfileId: profile.id }

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          passenger: { select: { id: true, name: true, phone: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.quote.count({ where }),
    ])
    return { quotes, meta: buildPaginationMeta(total, page, take) }
  }

  async respondToQuote(quoteId: string, userId: string, data: RespondQuoteInput) {
    const profile = await prisma.driverProfile.findUnique({ where: { userId } })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')

    const quote = await prisma.quote.findUnique({ where: { id: quoteId } })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')
    if (quote.driverProfileId && quote.driverProfileId !== profile.id) throw new AppError(403, 'Você não tem permissão para responder este orçamento')
    if (quote.status !== 'OPEN') throw new AppError(400, 'Este orçamento não está aberto para propostas')

    return prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'RESPONDED',
        responsePrice: data.responsePrice,
        responseNote: data.responseNote,
        driverProfileId: profile.id,
      },
    })
  }

  async acceptQuote(quoteId: string, passengerId: string) {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { driverProfile: true },
    })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')
    if (quote.passengerId !== passengerId) throw new AppError(403, 'Você não tem acesso a este orçamento')
    if (quote.status !== 'RESPONDED') throw new AppError(400, 'Este orçamento ainda não foi respondido')
    if (!quote.driverProfileId || !quote.responsePrice) throw new AppError(400, 'Orçamento está incompleto')

    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    const commissionRate = Number(settings?.commissionRate || 0.1)
    const totalPrice = Number(quote.responsePrice) * (1 + commissionRate)

    const [updatedQuote, trip] = await prisma.$transaction([
      prisma.quote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } }),
      prisma.trip.create({
        data: {
          passengerId,
          driverProfileId: quote.driverProfileId,
          quoteId,
          originAddress: quote.originAddress,
          destinationAddress: quote.destinationAddress,
          scheduledAt: quote.scheduledAt,
          totalPrice,
          notes: quote.notes,
        },
      }),
    ])

    return { quote: updatedQuote, trip }
  }

  async previewQuote(data: PreviewQuoteInput) {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    const commissionRate  = Number(settings?.commissionRate  ?? 0.1)
    const basePricePerKm  = settings?.basePricePerKm != null ? Number(settings.basePricePerKm) : null

    const availableDrivers = await prisma.driverProfile.count({
      where: { isApproved: true, isAvailable: true },
    })

    // Tenta calcular distância real via Nominatim + ORS (fallback: Haversine)
    let distanceKm: number | null = null
    let durationMin: number | null = null
    let distanceMethod: 'route' | 'estimate' | null = null
    try {
      const route = await getRouteDistance(data.originAddress, data.destinationAddress)
      distanceKm     = route.distanceKm
      durationMin    = route.durationMin
      distanceMethod = route.method
    } catch (err) {
      console.warn('[preview] calculo de distancia falhou:', (err as Error).message)
    }

    // Sem preço base configurado: não há estimativa de valor
    if (!basePricePerKm || !distanceKm) {
      return {
        availableDrivers,
        distanceKm,
        durationMin,
        distanceMethod,
        estimatedRange: null,
        commissionRate,
        note: !basePricePerKm
          ? 'Preco base por km nao configurado nas definicoes.'
          : 'Nao foi possivel calcular a distancia para esta rota.',
      }
    }

    // Avalia encargos extras dos parametros do sistema
    const { TripParameterService } = await import('../trip-parameter/trip-parameter.service')
    const paramService = new TripParameterService()

    const hour = data.scheduledAt ? new Date(data.scheduledAt).getHours() : undefined
    const basePrice = basePricePerKm * distanceKm
    const evaluation = await paramService.evaluate({
      distanceTotalKm: distanceKm,
      basePrice,
      departureHour: hour,
      target: 'TRIPS',
      isQuote: true,
    })

    const expectedNet   = basePrice + evaluation.totalExtraAmount
    const expectedTotal = expectedNet * (1 + commissionRate)

    const BUFFER = 0.15
    const estimatedRange = {
      minTotal: Number((expectedTotal * (1 - BUFFER)).toFixed(2)),
      maxTotal: Number((expectedTotal * (1 + BUFFER)).toFixed(2)),
    }

    return {
      availableDrivers,
      distanceKm,
      durationMin,
      distanceMethod,
      estimatedRange,
      commissionRate,
      note: distanceMethod === 'route'
        ? 'Estimativa baseada na distancia real da rota e nos parametros do sistema.'
        : 'Distancia estimada (rota aproximada). O valor final e definido pelo administrador.',
    }
  }

  async rejectQuote(quoteId: string, passengerId: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')
    if (quote.passengerId !== passengerId) throw new AppError(403, 'Você não tem acesso a este orçamento')

    return prisma.quote.update({ where: { id: quoteId }, data: { status: 'REJECTED' } })
  }

  // ── Admin: encaminhar para motorista específico ──────────────────────────
  async assignDirect(quoteId: string, driverId: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')
    if (!['OPEN', 'RESPONDED'].includes(quote.status)) {
      throw new AppError(400, 'Este orçamento não pode ser encaminhado (status inválido)')
    }

    const driver = await prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: { select: { id: true, name: true } } },
    })
    if (!driver) throw new AppError(404, 'Motorista não encontrado')
    if (!driver.isApproved) throw new AppError(400, 'Motorista não está aprovado')

    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    const commissionRate = Number(settings?.commissionRate ?? 0.1)
    const totalPrice = Number(quote.responsePrice ?? 0) * (1 + commissionRate)

    const [updatedQuote, trip] = await prisma.$transaction([
      prisma.quote.update({
        where: { id: quoteId },
        data: {
          status: 'ASSIGNED_DIRECT',
          driverProfileId: driverId,
          assignToken: null,
          assignExpiresAt: null,
        },
      }),
      prisma.trip.create({
        data: {
          passengerId:        quote.passengerId!,
          driverProfileId:    driverId,
          quoteId,
          originAddress:      quote.originAddress,
          destinationAddress: quote.destinationAddress,
          scheduledAt:        quote.scheduledAt,
          totalPrice:         totalPrice || 0,
          notes:              quote.notes,
          status:             'PENDING',
        },
      }),
    ])

    return { quote: updatedQuote, trip }
  }

  // ── Admin: encaminhar com link aberto (primeiro que aceitar fica) ────────
  async assignOpen(quoteId: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')
    if (!['OPEN', 'RESPONDED'].includes(quote.status)) {
      throw new AppError(400, 'Este orçamento não pode ser encaminhado (status inválido)')
    }

    const settings = await prisma.settings.findUnique({ where: { id: 1 } })
    const rawHours = Number(settings?.assignLinkExpiryHours)
    const expiryHours = Number.isFinite(rawHours) && rawHours > 0
      ? Math.min(rawHours, 720)
      : DEFAULT_ASSIGN_EXPIRY_HOURS

    const token = generateSecureToken()
    const assignExpiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    const updatedQuote = await prisma.quote.update({
      where: { id: quoteId },
      data: { status: 'ASSIGNED_OPEN', assignToken: token, assignExpiresAt },
    })

    const claimUrl = `${env.CORS_ORIGIN}/driver/claim-trip/${token}`
    return { quote: updatedQuote, claimUrl, expiresAt: assignExpiresAt }
  }

  // ── Admin: revogar (bloquear) link aberto antes de ser aceito ───────────
  async revokeOpenLink(quoteId: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')
    if (quote.status !== 'ASSIGNED_OPEN') {
      throw new AppError(400, 'Só é possível revogar um link aberto que ainda não foi aceito')
    }

    // Volta para RESPONDED se já havia preço respondido, senão OPEN — libera para reencaminhar
    const nextStatus = quote.responsePrice == null ? 'OPEN' : 'RESPONDED'

    // Update condicionado ao status atual: se um motorista aceitar entre o
    // findUnique acima e este update, count fica 0 e a revogação é rejeitada
    // em vez de sobrescrever silenciosamente uma viagem já aceita.
    const { count } = await prisma.quote.updateMany({
      where: { id: quoteId, status: 'ASSIGNED_OPEN' },
      data: { status: nextStatus, assignToken: null, assignExpiresAt: null },
    })
    if (count === 0) {
      throw new AppError(409, 'Este link já foi aceito por um motorista e não pode mais ser revogado')
    }

    const updatedQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } })
    return { quote: updatedQuote }
  }

  // ── Motorista: aceitar link aberto (first-come-first-served) ────────────
  async claimOpenTrip(token: string, driverUserId: string) {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
      include: { user: { select: { name: true } } },
    })
    if (!profile) throw new AppError(404, 'Perfil de motorista não encontrado')
    if (!profile.isApproved) throw new AppError(403, 'Seu perfil ainda não foi aprovado')
    if (isLicenseExpired(profile.licenseExpiry)) throw new AppError(403, LICENSE_EXPIRED_MESSAGE)

    // Transação atômica: garante que só um motorista consegue
    const result = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { assignToken: token } })

      if (!quote) throw new AppError(404, 'Link inválido ou já utilizado')
      if (quote.status !== 'ASSIGNED_OPEN') throw new AppError(409, 'Esta viagem já foi aceita por outro motorista')
      if (quote.assignExpiresAt && quote.assignExpiresAt < new Date()) {
        throw new AppError(410, 'Este link expirou. Solicite um novo ao administrador.')
      }

      const settings = await tx.settings.findUnique({ where: { id: 1 } })
      const commissionRate = Number(settings?.commissionRate ?? 0.1)
      const totalPrice = Number(quote.responsePrice ?? 0) * (1 + commissionRate)

      // Update condicionado ao status atual (não apenas ao id): garante que,
      // entre o findUnique acima e este update, nenhum outro motorista ou o
      // admin (revogação) já tenha alterado o status — fechando a janela de
      // corrida que um update simples por id não fecharia.
      const { count } = await tx.quote.updateMany({
        where: { id: quote.id, status: 'ASSIGNED_OPEN' },
        data: {
          status: 'ACCEPTED',
          driverProfileId: profile.id,
          assignToken: null,
          assignExpiresAt: null,
        },
      })
      if (count === 0) throw new AppError(409, 'Esta viagem já foi aceita por outro motorista')

      const [updatedQuote, trip] = await Promise.all([
        tx.quote.findUniqueOrThrow({ where: { id: quote.id } }),
        tx.trip.create({
          data: {
            passengerId:        quote.passengerId!,
            driverProfileId:    profile.id,
            quoteId:            quote.id,
            originAddress:      quote.originAddress,
            destinationAddress: quote.destinationAddress,
            scheduledAt:        quote.scheduledAt,
            totalPrice:         totalPrice || 0,
            notes:              quote.notes,
            status:             'CONFIRMED',
          },
        }),
      ])

      return { quote: updatedQuote, trip }
    })

    const passenger = await prisma.user.findUnique({
      where: { id: result.trip.passengerId },
      select: { name: true, email: true },
    })
    if (passenger) {
      const vehicleInfo = [profile.vehicleMake, profile.vehicleModel, profile.vehiclePlate].filter(Boolean).join(' ')
      const { subject, html } = tplViagemConfirmadaPassageiro({
        passengerName: passenger.name,
        tripId: result.trip.id,
        driverName: profile.user.name,
        vehicleInfo: vehicleInfo || 'Não informado',
        origin: result.trip.originAddress,
        destination: result.trip.destinationAddress,
        scheduledAt: result.trip.scheduledAt,
      })
      enqueueNotification({ to: passenger.email, subject, html }).catch(() => {})
    }

    return result
  }

  // ── Motorista: prévia do link aberto antes de aceitar ───────────────────
  async previewOpenTrip(token: string) {
    const quote = await prisma.quote.findUnique({
      where: { assignToken: token },
      include: {
        passenger: { select: { name: true } },
      },
    })

    if (!quote) throw new AppError(404, 'Link inválido ou já utilizado')
    if (quote.status !== 'ASSIGNED_OPEN') throw new AppError(409, 'Esta viagem já foi aceita por outro motorista')
    if (quote.assignExpiresAt && quote.assignExpiresAt < new Date()) {
      throw new AppError(410, 'Este link expirou. Solicite um novo ao administrador.')
    }

    return {
      originAddress:      quote.originAddress,
      destinationAddress: quote.destinationAddress,
      scheduledAt:        quote.scheduledAt,
      notes:              quote.notes,
      responsePrice:      Number(quote.responsePrice ?? 0),
      passengerName:      (quote.passenger as { name: string } | null)?.name ?? 'Passageiro',
      expiresAt:          quote.assignExpiresAt,
    }
  }

  // ── Admin: listar orçamentos com filtros ─────────────────────────────────
  async listAllQuotes(params: { status?: string; page?: number; limit?: number }) {
    const page  = params.page  ?? 1
    const limit = params.limit ?? 20
    const { take, skip } = getPaginationParams(page, limit)

    const where: Record<string, unknown> = {}
    if (params.status) where.status = params.status

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          passenger: { select: { id: true, name: true, email: true, phone: true } },
          driverProfile: {
            select: {
              id: true,
              vehicleMake: true,
              vehicleModel: true,
              user: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.quote.count({ where }),
    ])

    return { quotes, meta: buildPaginationMeta(total, page, take) }
  }
}
