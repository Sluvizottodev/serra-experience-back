import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import { env } from './common/config/env'
import { errorHandler } from './common/middlewares/error.middleware'

import { authRoutes } from './modules/auth/auth.routes'
import { userRoutes } from './modules/user/user.routes'
import { driverRoutes } from './modules/driver/driver.routes'
import { quoteRoutes } from './modules/quote/quote.routes'
import { tripRoutes } from './modules/trip/trip.routes'
import { paymentRoutes } from './modules/payment/payment.routes'
import { adminRoutes } from './modules/admin/admin.routes'
import { reportRoutes } from './modules/report/report.routes'
import { messageRoutes } from './modules/message/message.routes'
import { AdminService } from './modules/admin/admin.service'

const adminService = new AdminService()

const app = express()

app.use(helmet())
const allowedOrigins = env.CORS_ORIGIN.split(',').map(o => o.trim())

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
      callback(new Error(`Origem não permitida: ${origin}`))
    },
    credentials: true,
  })
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Muitas requisições, tente novamente mais tarde' },
})
app.use(globalLimiter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rota pública: expõe apenas campos seguros das configurações (whatsapp, siteName)
app.get('/api/settings', async (_req, res) => {
  try {
    const s = await adminService.getSettings()
    res.json({ whatsapp: s.whatsapp ?? null, siteName: s.siteName })
  } catch {
    res.status(500).json({ error: 'Erro ao buscar configurações' })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/quotes', quoteRoutes)
app.use('/api/trips', tripRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/reports', reportRoutes)
app.use('/api/messages', messageRoutes)

app.use(errorHandler)

export { app }