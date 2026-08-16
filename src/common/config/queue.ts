import { Client } from '@upstash/qstash'
import { env } from './env'
import { sendMail } from './mailer'

const qstash = env.QSTASH_TOKEN ? new Client({ token: env.QSTASH_TOKEN }) : null

export type NotificationJob = {
  to: string
  subject: string
  html: string
  // Se presente, checado pelo dispatch antes de enviar (evita lembrete de viagem já cancelada/alterada).
  guardTripId?: string
  guardStatus?: string
}

// Publica o envio de e-mail na fila (QStash chama de volta /notifications/dispatch,
// com retry automático em caso de falha). Sem QSTASH_TOKEN configurado, envia
// direto e de forma síncrona — mesmo comportamento que o projeto já tinha antes da fila.
// `notBeforeSeconds`: timestamp Unix (segundos) para entrega agendada — usado nos lembretes de viagem.
// Sem QStash configurado, envio agendado é ignorado (não há como atrasar o síncrono).
export async function enqueueNotification(job: NotificationJob, notBeforeSeconds?: number): Promise<void> {
  if (!qstash || !env.BACKEND_PUBLIC_URL) {
    if (notBeforeSeconds) return
    await sendMail(job.to, job.subject, job.html)
    return
  }

  await qstash.publishJSON({
    url: `${env.BACKEND_PUBLIC_URL}/api/notifications/dispatch`,
    body: job,
    retries: 3,
    ...(notBeforeSeconds ? { notBefore: notBeforeSeconds } : {}),
  })
}
