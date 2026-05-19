import { prisma } from '../../common/config/prisma'
import { AppError } from '../../common/middlewares/error.middleware'
import { getPaginationParams, buildPaginationMeta } from '../../common/utils/pagination'
import { getRouteDistance } from '../../common/utils/geo'
import type { CreateQuoteInput, RespondQuoteInput, PreviewQuoteInput } from './quote.schema'

const QUOTE_EXPIRY_HOURS = 48

export class QuoteService {
  async createQuote(passengerId: string, data: CreateQuoteInput) {
    // Se um motorista específico foi selecionado, validar capacidade
    if (data.driverProfileId) {
      const driver = await prisma.driverProfile.findUnique({
        where: { id: data.driverProfileId },
      })
      
      if (!driver) throw new AppError(404, 'Motorista não encontrado')
      if (!driver.isAvailable) throw new AppError(400, 'Motorista não está disponível no momento')
      if (driver.vehicleCapacity < data.passengerCount) {
        throw new AppError(400, `O veículo deste motorista comporta apenas ${driver.vehicleCapacity} ${driver.vehicleCapacity === 1 ? 'passageiro' : 'passageiros'}, mas você solicitou ${data.passengerCount}`)
      }
    }

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
    const commissionRate = Number(settings?.commissionRate || 0.1)

    const drivers = await prisma.driverProfile.findMany({
      where: { isApproved: true, isAvailable: true },
      select: {
        baseRatePerKm: true,
        baseRatePerHour: true,
        vehicleCapacity: true,
        rating: true,
      },
    })

    if (drivers.length === 0) {
      return {
        availableDrivers: 0,
        distanceKm: null,
        durationMin: null,
        estimatedRange: null,
        commissionRate,
        note: 'Nenhum motorista disponível no momento',
      }
    }

    // Tenta calcular distância real via Nominatim + ORS (fallback: Haversine)
    let distanceKm: number | null = null
    let durationMin: number | null = null
    let distanceMethod: 'route' | 'estimate' | null = null
    try {
      const route = await getRouteDistance(data.originAddress, data.destinationAddress)
      distanceKm    = route.distanceKm
      durationMin   = route.durationMin
      distanceMethod = route.method
    } catch (err) {
      console.warn('[preview] cálculo de distância falhou:', (err as Error).message)
    }

    const rates = drivers.map(d => ({
      perKm:   Number(d.baseRatePerKm),
      perHour: Number(d.baseRatePerHour),
    }))

    const minPerKm   = Math.min(...rates.map(r => r.perKm))
    const maxPerKm   = Math.max(...rates.map(r => r.perKm))
    const minPerHour = Math.min(...rates.map(r => r.perHour))
    const maxPerHour = Math.max(...rates.map(r => r.perHour))
    const avgRating  = drivers.reduce((s, d) => s + Number(d.rating), 0) / drivers.length

    // Se temos distância, calcula faixa de preço estimada com comissão
    const estimatedRange = distanceKm
      ? {
          minTotal: Number(((minPerKm * distanceKm) * (1 + commissionRate)).toFixed(2)),
          maxTotal: Number(((maxPerKm * distanceKm) * (1 + commissionRate)).toFixed(2)),
        }
      : null

    return {
      availableDrivers: drivers.length,
      distanceKm,
      durationMin,
      distanceMethod,
      estimatedRange,
      commissionRate,
      rates: { minPerKm, maxPerKm, minPerHour, maxPerHour },
      avgDriverRating: Number(avgRating.toFixed(1)),
      note: distanceMethod === 'route'
        ? 'Estimativa baseada na distância real da rota e nas taxas dos motoristas disponíveis.'
        : distanceMethod === 'estimate'
          ? 'Distância estimada (rota aproximada). O valor final é proposto pelo motorista.'
          : 'Estimativa baseada nas taxas dos motoristas. Configure OPENROUTE_API_KEY para cálculo por distância.',
    }
  }

  async rejectQuote(quoteId: string, passengerId: string) {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')
    if (quote.passengerId !== passengerId) throw new AppError(403, 'Você não tem acesso a este orçamento')

    return prisma.quote.update({ where: { id: quoteId }, data: { status: 'REJECTED' } })
  }
}
