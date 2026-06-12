import { Router } from 'express'
import { MetricsController } from './metrics.controller'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'

const router = Router()
const controller = new MetricsController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch(err =>
    res.status(400).json({ error: err.message })
  )

// Endpoints públicos (sem auth) — coleta de sessão do visitante
router.post('/session/start', wrap(controller.sessionStart))
router.post('/session/end', wrap(controller.sessionEnd))

// Endpoints admin
router.get('/admin', isAuthenticated, isAdmin, wrap(controller.getMetrics))
router.get('/admin/export-csv', isAuthenticated, isAdmin, wrap(controller.exportCsv))

export { router as metricsRoutes }
