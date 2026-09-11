import { Router } from 'express'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'
import { upload } from '../../common/middlewares/upload.middleware'
import { listPublic, listAll, create, update, remove, uploadImage } from './testimonial.controller'

const router = Router()

const wrap = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res)).catch(next)

router.get('/public', wrap(listPublic))

router.use(isAuthenticated, isAdmin)

router.get('/', wrap(listAll))
router.post('/', wrap(create))
router.put('/:id', wrap(update))
router.delete('/:id', wrap(remove))
router.post('/:id/image', upload.single('image'), wrap(uploadImage))

export { router as testimonialRoutes }
