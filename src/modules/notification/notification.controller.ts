import { Request, Response } from 'express'
import { Receiver } from '@upstash/qstash'
import { env } from '../../common/config/env'
import { sendMail } from '../../common/config/mailer'
import { prisma } from '../../common/config/prisma'
import { AppError } from '../../common/middlewares/error.middleware'
import type { NotificationJob } from '../../common/config/queue'

const receiver = env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY
  ? new Receiver({
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    })
  : null

export class NotificationController {
  // Chamado pela QStash para efetivar o envio de um e-mail enfileirado.
  // Só aceita requisições assinadas pela QStash — qualquer outra origem é rejeitada.
  async dispatch(req: Request, res: Response) {
    if (!receiver) throw new AppError(503, 'Fila de notificações não configurada')

    const signature = req.header('upstash-signature')
    if (!signature) throw new AppError(401, 'Assinatura ausente')

    const rawBody = req.body as string
    const valid = await receiver.verify({ signature, body: rawBody })
    if (!valid) throw new AppError(401, 'Assinatura inválida')

    const job = JSON.parse(rawBody) as NotificationJob

    // Lembretes agendados carregam um guard: só envia se a viagem ainda estiver no status esperado
    // (evita lembrar de uma viagem que foi cancelada/alterada entre o agendamento e a entrega).
    if (job.guardTripId && job.guardStatus) {
      const trip = await prisma.trip.findUnique({ where: { id: job.guardTripId }, select: { status: true } })
      if (trip?.status !== job.guardStatus) {
        res.status(200).json({ ok: true, skipped: true })
        return
      }
    }

    await sendMail(job.to, job.subject, job.html)

    res.status(200).json({ ok: true })
  }
}
