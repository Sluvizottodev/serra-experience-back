import { Request, Response, NextFunction } from 'express'

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  vehiclePlate: 'Esta placa já está cadastrada para outro motorista',
  email: 'Este e-mail já está em uso',
  phone: 'Este telefone já está em uso',
  licenseNumber: 'Este número de CNH já está cadastrado para outro motorista',
}

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
    const message = UNIQUE_FIELD_LABELS[field] || `${field} já existe no sistema`
    res.status(409).json({
      error: message,
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

  if (err.code === 'P2003') {
    res.status(409).json({
      error: 'Esta ação não pode ser concluída pois há dados relacionados',
      statusCode: 409,
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Outros erros conhecidos do Prisma (código começa com "P")
  if (typeof err.code === 'string' && err.code.startsWith('P')) {
    res.status(400).json({
      error: 'Não foi possível processar os dados enviados',
      statusCode: 400,
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Corpo JSON malformado (express.json())
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: 'Requisição inválida',
      statusCode: 400,
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Erros de validação JWT
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Token inválido',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    })
    return
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Sessão expirada, faça login novamente',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    })
    return
  }

  // Erros genéricos — qualquer coisa não tratada acima cai aqui,
  // sempre com uma mensagem amigável e padronizada para o usuário final
  res.status(500).json({
    error: 'Ocorreu um erro inesperado. Tente novamente em instantes.',
    statusCode: 500,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { details: err?.message ?? String(err) }),
  })
}
