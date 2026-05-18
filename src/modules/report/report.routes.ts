import { Router } from 'express'
import { ReportController } from './report.controller'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'

const router = Router()
const controller = new ReportController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch(err =>
    res.status(400).json({ error: err.message })
  )

router.use(isAuthenticated, isAdmin)

router.get('/trips', wrap(controller.exportTrips))
router.get('/revenue', wrap(controller.getRevenue))
router.get('/drivers', wrap(controller.getDriversReport))

export { router as reportRoutes }
