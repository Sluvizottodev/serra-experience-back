import { Router } from 'express'
import { InfluencerController } from './influencer.controller'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { createInfluencerSchema, updateInfluencerSchema, createLinkSchema } from './influencer.schema'

const router = Router()
const controller = new InfluencerController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

// públicas — sem auth; nunca devem quebrar a página pública mesmo com dados inválidos
router.post('/track/view', wrap(controller.trackView))
router.post('/track/conversion', wrap(controller.trackConversion))

// admin only
router.use(isAuthenticated, isAdmin)
router.get('/', wrap(controller.listAdmin))
router.post('/', validate(createInfluencerSchema), wrap(controller.create))
router.put('/:id', validate(updateInfluencerSchema), wrap(controller.update))
router.delete('/:id', wrap(controller.remove))
router.get('/:influencerId/links', wrap(controller.listLinksByInfluencer))
router.post('/:influencerId/links', validate(createLinkSchema), wrap(controller.createLink))
router.get('/links/by-event/:eventId', wrap(controller.listLinksByEvent))
router.get('/admin/metrics', wrap(controller.getMetrics))

export { router as influencerRoutes }
