import { z } from 'zod'
import { isValidCpf } from '../../common/utils/cpf'

export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome não pode exceder 100 caracteres'),
  email: z.string()
    .email('E-mail inválido')
    .transform(e => e.toLowerCase().trim()),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter um número')
    .regex(/[!@#$%^&*]/, 'Senha deve conter um caractere especial (!@#$%^&*)'),
  phone: z.string()
    .regex(/^\d{10,11}$/, 'Telefone inválido')
    .optional(),
  cpf: z.string()
    .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')
    .refine(isValidCpf, 'CPF inválido')
    .optional(),
  role: z.enum(['PASSENGER', 'DRIVER']).default('PASSENGER'),
})

export const loginSchema = z.object({
  email: z.string()
    .email('E-mail inválido')
    .transform(e => e.toLowerCase().trim()),
  password: z.string()
    .min(1, 'Senha é obrigatória'),
})

export const verifyOtpSchema = z.object({
  email: z.string()
    .email('E-mail inválido')
    .transform(e => e.toLowerCase().trim()),
  code: z.string()
    .length(6, 'Código deve ter exatamente 6 dígitos')
    .regex(/^\d{6}$/, 'Código deve conter apenas números'),
})

export const resendOtpSchema = z.object({
  email: z.string()
    .email('E-mail inválido')
    .transform(e => e.toLowerCase().trim()),
})

export const forgotPasswordSchema = z.object({
  email: z.string()
    .email('E-mail inválido')
    .transform(e => e.toLowerCase().trim()),
})

export const resetPasswordSchema = z.object({
  token: z.string().length(64, 'Token inválido').regex(/^[a-f0-9]{64}$/, 'Token inválido'),
  password: z.string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter um número')
    .regex(/[!@#$%^&*]/, 'Senha deve conter um caractere especial (!@#$%^&*)'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
