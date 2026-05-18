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

const app = express()

app.use(helmet())
app.use(
  cors({
    origin: env.CORS_ORIGIN,
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