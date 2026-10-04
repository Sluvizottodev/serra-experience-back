import { Router } from 'express'
import { searchCities, searchStreets, searchAddresses, reverse } from './place.controller'

const router = Router()

const wrap = (fn: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res)).catch(next)

// Públicas: o formulário de orçamento é usado por visitante sem conta.
router.get('/cities', wrap(searchCities))
router.get('/streets', wrap(searchStreets))
router.get('/addresses', wrap(searchAddresses))
router.get('/reverse', wrap(reverse))

export { router as placeRoutes }
