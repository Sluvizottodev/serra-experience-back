import { Router } from 'express'
import { EventController } from './event.controller'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { upload } from '../../common/middlewares/upload.middleware'
import { createEventSchema, updateEventSchema } from './event.schema'

const router = Router()
const controller = new EventController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

// public — no auth required
router.get('/public', wrap(controller.listPublic))
router.get('/sitemap', wrap(controller.sitemap))
router.get('/public/:slug', wrap(controller.getBySlug))

// admin only
router.use(isAuthenticated, isAdmin)
router.get('/', wrap(controller.listAdmin))
router.post('/', validate(createEventSchema), wrap(controller.create))
router.put('/:id', validate(updateEventSchema), wrap(controller.update))
router.delete('/:id', wrap(controller.remove))
router.post('/:id/image', upload.single('image'), wrap(controller.uploadImage))

export { router as eventRoutes }
