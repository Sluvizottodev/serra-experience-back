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
import { eventRoutes } from './modules/event/event.routes'
import { eventBookingRoutes } from './modules/event-booking/event-booking.routes'
import { partnerRoutes } from './modules/partner/partner.routes'
import { testimonialRoutes } from './modules/testimonial/testimonial.routes'
import { tripParameterRoutes } from './modules/trip-parameter/trip-parameter.routes'
import { metricsRoutes } from './modules/metrics/metrics.routes'
import { notificationRoutes } from './modules/notification/notification.routes'
import { influencerRoutes } from './modules/influencer/influencer.routes'
import { AdminService } from './modules/admin/admin.service'
import { prisma } from './common/config/prisma'

const adminService = new AdminService()

const app = express()
app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        frameSrc: ["'self'", 'https://www.youtube-nocookie.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
)
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
// Montada antes do express.json(): a QStash assina o corpo bruto da requisição,
// e o parser JSON global substituiria esse corpo antes da verificação de assinatura.
app.use('/api/notifications', notificationRoutes)

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

const SITE_URL = 'https://serraexperience.com.br'

const staticPages = [
  { loc: '/',                  changefreq: 'weekly',  priority: '1.0' },
  { loc: '/drivers',           changefreq: 'daily',   priority: '0.9' },
  { loc: '/eventos',           changefreq: 'weekly',  priority: '0.8' },
  { loc: '/orcamento-preview', changefreq: 'monthly', priority: '0.8' },
]

app.get('/sitemap.xml', async (_req, res) => {
  const today = new Date().toISOString().slice(0, 10)

  const xmlUrl = (loc: string, lastmod: string, changefreq: string, priority: string) =>
    `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`

  // Falha do banco não deve derrubar o sitemap: um 500 faz o Bing/Google
  // marcarem o sitemap como quebrado. Degradamos para as páginas estáticas.
  let events: { slug: string; updatedAt: Date }[] = []
  try {
    events = await prisma.event.findMany({
      where: { active: true },
      select: { slug: true, updatedAt: true },
      orderBy: { order: 'asc' },
    })
  } catch {
    events = []
  }

  const urls = [
    ...staticPages.map(p => xmlUrl(p.loc, today, p.changefreq, p.priority)),
    ...events.map(ev =>
      xmlUrl(
        `/eventos/${ev.slug}`,
        ev.updatedAt.toISOString().slice(0, 10),
        'weekly',
        '0.8',
      )
    ),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n\n')}\n</urlset>`

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.send(xml)
})
const INDEXNOW_KEY = process.env.INDEXNOW_KEY
if (INDEXNOW_KEY) {
  app.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(INDEXNOW_KEY)
  })
}

// Rotas públicas (sem prefixo /api — o frontend chama com barra inicial que remove o baseURL /api/)
app.get('/api/settings', async (_req, res) => {
  try {
    const s = await adminService.getSettings()
    res.json({
      whatsapp: s.whatsapp ?? null,
      siteName: s.siteName,
      baseAddress: s.baseAddress ?? null,
      youtubeVideoUrl: s.youtubeVideoUrl ?? null,
    })
  } catch {
    res.status(500).json({ error: 'Erro ao buscar configurações' })
  }
})

app.use('/api/events', eventRoutes)
app.use('/api/event-bookings', eventBookingRoutes)
app.use('/api/partners', partnerRoutes)
app.use('/api/testimonials', testimonialRoutes)

app.get('/api/reviews/public', async (_req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { isVisible: true, comment: { not: null } },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        author: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    res.json(reviews)
  } catch {
    res.status(500).json({ error: 'Erro ao buscar avaliações' })
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
app.use('/api/trip-parameters', tripParameterRoutes)
app.use('/api/metrics', metricsRoutes)
app.use('/api/influencers', influencerRoutes)

app.use(errorHandler)

export { app }