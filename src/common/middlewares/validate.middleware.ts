import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

export interface ValidationError {
  field: string
  messages: string[]
}

export function validate(schema: ZodSchema, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = source === 'body' ? req.body : req.query
    const result = schema.safeParse(data)
    
    if (!result.success) {
      const errors: ValidationError[] = []
      
      result.error.issues.forEach(issue => {
        const field = issue.path.join('.')
        const existing = errors.find(e => e.field === field)
        
        if (existing) {
          existing.messages.push(issue.message)
        } else {
          errors.push({ field, messages: [issue.message] })
        }
      })

      res.status(400).json({
        error: 'Validação falhou',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        details: errors,
      })
      return
    }

    if (source === 'body') {
      req.body = result.data
    } else {
      req.query = result.data as any
    }
    next()
  }
}
