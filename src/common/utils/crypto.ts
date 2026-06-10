import crypto from 'crypto'
import { env } from '../config/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const key = Buffer.from(env.CPF_ENCRYPTION_KEY, 'hex')
  if (key.length !== 32) throw new Error('CPF_ENCRYPTION_KEY deve ter 64 caracteres hex (256 bits)')
  return key
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // formato: iv(12) + tag(16) + ciphertext — tudo em hex
  return Buffer.concat([iv, tag, encrypted]).toString('hex')
}

export function decrypt(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'hex')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
