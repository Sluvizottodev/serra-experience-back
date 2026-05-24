import { Router } from 'express'
import { PartnerController } from './partner.controller'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { upload } from '../../common/middlewares/upload.middleware'
import { createPartnerSchema, updatePartnerSchema } from './partner.schema'

const router = Router()
const controller = new PartnerController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

// public — no auth required
router.get('/public', wrap(controller.listPublic))

// admin only
router.use(isAuthenticated, isAdmin)
router.get('/', wrap(controller.listAdmin))
router.post('/', validate(createPartnerSchema), wrap(controller.create))
router.put('/:id', validate(updatePartnerSchema), wrap(controller.update))
router.delete('/:id', wrap(controller.remove))
router.post('/:id/logo', upload.single('logo'), wrap(controller.uploadLogo))

export { router as partnerRoutes }
