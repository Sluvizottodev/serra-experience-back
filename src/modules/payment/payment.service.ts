import axios from 'axios'
import { v4 as uuid } from 'uuid'
import { prisma } from '../../common/config/prisma'
import { env } from '../../common/config/env'
import { PaymentLoggerService } from './payment.logger'

const logger = new PaymentLoggerService()
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 500

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function picpayRequest<T>(
  method: 'post' | 'get',
  path: string,
  data?: unknown,
  retries = MAX_RETRIES
): Promise<T> {
  const url = `${env.PICPAY_API_URL}${path}`
  const headers = {
    'x-picpay-token': env.PICPAY_TOKEN,
    'Content-Type': 'application/json',
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const start = Date.now()
    try {
      const response = await axios({ method, url, headers, data })
      await logger.log({
        operationType: method.toUpperCase(),
        transactionId: (data as Record<string, string>)?.referenceId,
        status: String(response.status),
        severity: 'INFO',
        requestPayload: { path, data: data as Record<string, unknown> },
        responsePayload: response.data,
        durationMs: Date.now() - start,
      })
      return response.data as T
    } catch (err: unknown) {
      const durationMs = Date.now() - start
      const isLast = attempt === retries
      const status = axios.isAxiosError(err) ? String(err.response?.status) : 'NETWORK_ERROR'
      await logger.log({
        operationType: method.toUpperCase(),
        status,
        severity: isLast ? 'ERROR' : 'WARN',
        requestPayload: { path, data: data as Record<string, unknown> },
        responsePayload: axios.isAxiosError(err) ? (err.response?.data as Record<string, unknown>) : { message: String(err) },
        durationMs,
      })
      if (isLast) throw err
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
  throw new Error('Max retries exceeded')
}

export class PaymentService {
  async createCharge(tripId: string, passengerId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        passenger: true,
        payment: true,
      },
    })
    if (!trip) throw new Error('Viagem não encontrada')
    if (trip.passengerId !== passengerId) throw new Error('Acesso negado')
    if (trip.status === 'CANCELLED') throw new Error('Viagem cancelada')
    if (trip.payment?.status === 'PAID') throw new Error('Viagem já paga')

    const referenceId = trip.payment?.externalTransactionId || uuid()

    const payload = {
      referenceId,
      callbackUrl: `${process.env.CORS_ORIGIN}/api/payments/webhook`,
      returnUrl: `${process.env.CORS_ORIGIN}/trips/${tripId}`,
      value: Number(trip.totalPrice),
      buyer: {
        firstName: trip.passenger.name.split(' ')[0],
        lastName: trip.passenger.name.split(' ').slice(1).join(' ') || 'N/A',
        document: trip.passenger.cpf || '000.000.000-00',
        email: trip.passenger.email,
        phone: trip.passenger.phone || '+5500000000000',
      },
    }

    const result = await picpayRequest<{ paymentUrl: string; expiresAt: string }>(
      'post',
      '/payments',
      payload
    )

    await prisma.payment.upsert({
      where: { tripId },
      create: {
        tripId,
        externalTransactionId: referenceId,
        amount: trip.totalPrice,
        status: 'PENDING',
        paymentUrl: result.paymentUrl,
      },
      update: {
        paymentUrl: result.paymentUrl,
      },
    })

    return { paymentUrl: result.paymentUrl, referenceId }
  }

  async getPaymentStatus(tripId: string, userId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        payment: true,
        driverProfile: { select: { userId: true } },
      },
    })
    if (!trip) throw new Error('Viagem não encontrada')

    const isPassenger = trip.passengerId === userId
    const isDriver = trip.driverProfile?.userId === userId
    if (!isPassenger && !isDriver) throw new Error('Acesso negado')

    return trip.payment
  }

  async handleWebhook(body: Record<string, unknown>, sellerToken: string | undefined) {
    if (!env.PICPAY_SELLER_TOKEN || sellerToken !== env.PICPAY_SELLER_TOKEN) {
      await logger.log({
        operationType: 'WEBHOOK',
        status: '401',
        severity: 'WARN',
        requestPayload: { reason: 'invalid_seller_token' },
      })
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    }

    const { referenceId, authorizationId, status } = body

    await logger.log({
      operationType: 'WEBHOOK',
      transactionId: String(referenceId),
      requestId: String(authorizationId),
      status: String(status),
      severity: 'INFO',
      requestPayload: body,
    })

    if (status === 'paid') {
      const payment = await prisma.payment.findUnique({
        where: { externalTransactionId: String(referenceId) },
      })

      if (payment) {
        const expectedAmount = Number(payment.amount)
        const receivedAmount = typeof body.amount === 'number' ? body.amount : null

        if (receivedAmount !== null && Math.abs(receivedAmount - expectedAmount) > 0.01) {
          await logger.log({
            operationType: 'WEBHOOK',
            transactionId: String(referenceId),
            status: 'AMOUNT_MISMATCH',
            severity: 'ERROR',
            requestPayload: { expected: expectedAmount, received: receivedAmount },
          })
          throw Object.assign(new Error('Payment amount mismatch'), { statusCode: 400 })
        }

        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'PAID', paidAt: new Date() },
          }),
          prisma.trip.update({
            where: { id: payment.tripId },
            data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
          }),
        ])
      }
    }

    return { received: true }
  }
}
