import { Router } from 'express'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'
import { listPublic, listAll, create, update, remove } from './testimonial.controller'

const router = Router()

router.get('/public', listPublic)

router.use(isAuthenticated, isAdmin)

router.get('/', listAll)
router.post('/', create)
router.put('/:id', update)
router.delete('/:id', remove)

export { router as testimonialRoutes }
