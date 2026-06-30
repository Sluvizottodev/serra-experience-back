import { Router } from 'express'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'
import { upload } from '../../common/middlewares/upload.middleware'
import { listPublic, listAll, create, update, remove, uploadImage } from './testimonial.controller'

const router = Router()

router.get('/public', listPublic)

router.use(isAuthenticated, isAdmin)

router.get('/', listAll)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)
router.post('/:id/image', upload.single('image'), uploadImage)

export { router as testimonialRoutes }
