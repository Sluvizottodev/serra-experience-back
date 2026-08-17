import { describe, it, expect } from 'vitest'
import { updateTripStatusSchema, cancelTripSchema, reviewSchema } from './trip.schema'

describe('updateTripStatusSchema', () => {
  it('aceita um status válido sem motivo', () => {
    const result = updateTripStatusSchema.safeParse({ status: 'CONFIRMED' })
    expect(result.success).toBe(true)
  })

  it('rejeita status fora do enum', () => {
    const result = updateTripStatusSchema.safeParse({ status: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('rejeita cancelReason muito curto', () => {
    const result = updateTripStatusSchema.safeParse({ status: 'CANCELLED', cancelReason: 'ab' })
    expect(result.success).toBe(false)
  })
})

describe('cancelTripSchema', () => {
  it('exige cancelReason com pelo menos 5 caracteres', () => {
    expect(cancelTripSchema.safeParse({ cancelReason: 'curto' }).success).toBe(true)
    expect(cancelTripSchema.safeParse({ cancelReason: 'abcd' }).success).toBe(false)
    expect(cancelTripSchema.safeParse({}).success).toBe(false)
  })
})

describe('reviewSchema', () => {
  it('aceita rating entre 1 e 5', () => {
    expect(reviewSchema.safeParse({ rating: 1 }).success).toBe(true)
    expect(reviewSchema.safeParse({ rating: 5 }).success).toBe(true)
  })

  it('rejeita rating fora do intervalo', () => {
    expect(reviewSchema.safeParse({ rating: 0 }).success).toBe(false)
    expect(reviewSchema.safeParse({ rating: 6 }).success).toBe(false)
  })

  it('rejeita rating não inteiro', () => {
    expect(reviewSchema.safeParse({ rating: 3.5 }).success).toBe(false)
  })
})
