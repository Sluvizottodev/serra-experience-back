import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { AuthController } from './auth.controller'
import { validate } from '../../common/middlewares/validate.middleware'
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema'

const router = Router()
const controller = new AuthController()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
})

const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Limite de reenvios atingido. Tente novamente em 15 minutos.' },
})

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de recuperação. Tente novamente em 1 hora.' },
})

const wrap = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn.call(controller, req, res, next)).catch((err: any) => {
    const status = err.statusCode ?? 400
    res.status(status).json({ error: err.message })
  })

router.post('/register', authLimiter, validate(registerSchema), wrap(controller.register))
router.post('/login', authLimiter, validate(loginSchema), wrap(controller.login))
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), wrap(controller.verifyOtp))
router.post('/resend-otp', resendOtpLimiter, validate(resendOtpSchema), wrap(controller.resendOtp))
router.post('/refresh-token', wrap(controller.refreshToken))
router.post('/logout', wrap(controller.logout))
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), wrap(controller.forgotPassword))
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), wrap(controller.resetPassword))

export { router as authRoutes }
