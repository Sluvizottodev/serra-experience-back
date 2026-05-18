import { Request } from 'express'

export interface AuthRequest extends Request {
  user?: {
    id: string
    role: string
    email: string
  }
}

export interface PaginationQuery {
  page?: number
  limit?: number
}

export interface ApiResponse<T = unknown> {
  data?: T
  message?: string
  error?: string
}
