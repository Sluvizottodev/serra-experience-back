import { Router } from 'express'
import { TripParameterController } from './trip-parameter.controller'
import { isAuthenticated, isAdmin } from '../../common/middlewares/auth.middleware'
import { validate } from '../../common/middlewares/validate.middleware'
import { createParameterSchema, updateParameterSchema } from './trip-parameter.schema'

const router = Router()
const controller = new TripParameterController()

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

// public — avalia parâmetros para um orçamento/viagem (usado no frontend do cliente)
router.post('/evaluate', wrap(controller.evaluate))
router.get('/active', wrap(controller.listActive))

// admin only
router.use(isAuthenticated, isAdmin)
router.get('/',      wrap(controller.list))
router.get('/:id',   wrap(controller.getById))
router.post('/',     validate(createParameterSchema), wrap(controller.create))
router.put('/:id',   validate(updateParameterSchema), wrap(controller.update))
router.delete('/:id', wrap(controller.remove))

export { router as tripParameterRoutes }
