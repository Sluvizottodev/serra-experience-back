import { Resend } from 'resend'
import { env } from './env'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export async function sendMail(to: string, subject: string, html: string) {
  if (!resend) {
    if (env.NODE_ENV !== 'production') {
      console.log(`[MAIL] To: ${to} | Subject: ${subject}`)
      const otpMatch = /\b\d{6}\b/.exec(html)
      if (otpMatch) console.log(`[MAIL] OTP CODE: ${otpMatch[0]}`)
    }
    return
  }

  const { error } = await resend.emails.send({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}
