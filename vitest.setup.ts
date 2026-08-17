// Env fake mínima para satisfazer o schema de src/common/config/env.ts em CI,
// onde não há segredos reais nem banco de dados disponíveis.
process.env.NODE_ENV ??= 'test'
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
process.env.JWT_SECRET ??= 'test-jwt-secret'
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret'
process.env.PICPAY_SELLER_TOKEN ??= 'test-picpay-seller-token'
process.env.CPF_ENCRYPTION_KEY ??= '0'.repeat(64)
