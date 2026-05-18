import { Router } from 'express'
import { UserController } from './user.controller'
import { isAuthenticated } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { upload } from '../../common/middlewares/upload.middleware'
import { updateUserSchema } from './user.schema'

const router = Router()
const controller = new UserController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

router.use(isAuthenticated)

router.get('/me', wrap(controller.getMe))
router.put('/me', validate(updateUserSchema), wrap(controller.updateMe))
router.post('/me/avatar', upload.single('avatar'), wrap(controller.uploadAvatar))
router.post('/me/id-document', upload.single('document'), wrap(controller.uploadIdDocument))

export { router as userRoutes }
