import { Client } from '@upstash/qstash'
import { env } from './env'
import { sendMail } from './mailer'

const qstash = env.QSTASH_TOKEN ? new Client({ token: env.QSTASH_TOKEN }) : null

export type NotificationJob = {
  to: string
  subject: string
  html: string
}

// Publica o envio de e-mail na fila (QStash chama de volta /notifications/dispatch,
// com retry automático em caso de falha). Sem QSTASH_TOKEN configurado, envia
// direto e de forma síncrona — mesmo comportamento que o projeto já tinha antes da fila.
export async function enqueueNotification(job: NotificationJob): Promise<void> {
  if (!qstash || !env.BACKEND_PUBLIC_URL) {
    await sendMail(job.to, job.subject, job.html)
    return
  }

  await qstash.publishJSON({
    url: `${env.BACKEND_PUBLIC_URL}/api/notifications/dispatch`,
    body: job,
    retries: 3,
  })
}
