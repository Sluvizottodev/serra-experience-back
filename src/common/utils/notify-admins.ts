import { prisma } from '../config/prisma'
import { sendMail } from '../config/mailer'

export async function notifyAdmins(subject: string, html: string): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  })

  await Promise.allSettled(admins.map(a => sendMail(a.email, subject, html)))
}
