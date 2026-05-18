import nodemailer from 'nodemailer'
import { env } from './env'

const smtpConfigured = !!(env.SMTP_USER && env.SMTP_PASS)

export const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null

export async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    console.log(`[MAIL] To: ${to} | Subject: ${subject}`)
    const otpMatch = html.match(/\b\d{6}\b/)
    if (otpMatch) console.log(`[MAIL] OTP CODE: ${otpMatch[0]}`)
    return
  }
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
  })
}
