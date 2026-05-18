import { prisma } from '../../common/config/prisma'
import { Severity } from '@prisma/client'

interface LogPaymentOptions {
  operationType: string
  transactionId?: string
  requestId?: string
  status?: string
  severity?: Severity
  requestPayload?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  durationMs?: number
}

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitive = ['token', 'password', 'secret', 'authorization', 'x-picpay-token']
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = value
    }
  }
  return result
}

export class PaymentLoggerService {
  async log(opts: LogPaymentOptions) {
    try {
      await prisma.paymentLog.create({
        data: {
          provider: 'PICPAY',
          operationType: opts.operationType,
          transactionId: opts.transactionId,
          requestId: opts.requestId,
          status: opts.status,
          severity: opts.severity || 'INFO',
          requestPayloadSanitized: opts.requestPayload ? sanitize(opts.requestPayload) : undefined,
          responsePayloadSanitized: opts.responsePayload ? sanitize(opts.responsePayload) : undefined,
          durationMs: opts.durationMs,
        },
      })
    } catch (err) {
      console.error('Failed to write payment log:', err)
    }
  }
}
