import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error('❌ Error:', err)

  // Erros de aplicação conhecidos
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
      timestamp: new Date().toISOString(),
      ...(err.details && { details: err.details }),
    })
    return
  }

  // Erros de banco de dados
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'campo'
    res.status(409).json({
      error: `${field} já existe no sistema`,
      statusCode: 409,
      timestamp: new Date().toISOString(),
      details: { field, reason: 'duplicate' },
    })
    return
  }

  if (err.code === 'P2025') {
    res.status(404).json({
      error: 'Recurso não encontrado',
      statusCode: 404,
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Erros de validação JWT
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Token inválido ou expirado',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Erros genéricos
  res.status(500).json({
    error: 'Erro interno do servidor',
    statusCode: 500,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  })
}
