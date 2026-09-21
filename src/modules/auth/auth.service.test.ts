import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock, resetPrismaMock } from '../../test/prisma.mock'
import { AuthService } from './auth.service'

vi.mock('../../common/config/prisma', () => ({ prisma: prismaMock }))
vi.mock('../../common/config/mailer', () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../common/utils/jwt', () => ({
  signAccessToken: vi.fn(() => 'access-token'),
  signRefreshToken: vi.fn(() => 'refresh-token'),
  verifyRefreshToken: vi.fn(),
}))

const futureDate = () => new Date(Date.now() + 5 * 60 * 1000)
const pastDate = () => new Date(Date.now() - 5 * 60 * 1000)

function fakeRes() {
  return { cookie: vi.fn() } as unknown as import('express').Response
}

// $transaction recebe um callback (tx) — devolvemos o próprio mock como tx.
function wireTransaction() {
  prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prismaMock))
}

describe('AuthService.verifyOtp', () => {
  let service: InstanceType<typeof AuthService>

  beforeEach(() => {
    resetPrismaMock()
    service = new AuthService()
    prismaMock.refreshToken.create.mockResolvedValue({})
    wireTransaction()
  })

  it('cria o DriverProfile junto do usuário quando a role é DRIVER', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      email: 'motorista@teste.com', name: 'Motorista', password: 'hash',
      phone: null, cpf: null, role: 'DRIVER', otpCode: '123456', otpExpiresAt: futureDate(),
    })
    prismaMock.user.create.mockResolvedValue({
      id: 'u1', name: 'Motorista', email: 'motorista@teste.com',
      role: 'DRIVER', isVerified: true, avatarUrl: null,
    })

    const result = await service.verifyOtp({ email: 'motorista@teste.com', code: '123456' }, fakeRes())

    expect(prismaMock.driverProfile.create).toHaveBeenCalledWith({
      data: { userId: 'u1', vehicleStatus: 'PENDING' },
    })
    // O perfil precisa nascer dentro da mesma transação do usuário
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(result.accessToken).toBe('access-token')
    expect(result.user.role).toBe('DRIVER')
  })

  it('não cria DriverProfile para passageiro', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      email: 'passageiro@teste.com', name: 'Passageiro', password: 'hash',
      phone: null, cpf: null, role: 'PASSENGER', otpCode: '123456', otpExpiresAt: futureDate(),
    })
    prismaMock.user.create.mockResolvedValue({
      id: 'u2', name: 'Passageiro', email: 'passageiro@teste.com',
      role: 'PASSENGER', isVerified: true, avatarUrl: null,
    })

    await service.verifyOtp({ email: 'passageiro@teste.com', code: '123456' }, fakeRes())

    expect(prismaMock.driverProfile.create).not.toHaveBeenCalled()
  })

  it('emite sessão autenticada ao concluir a verificação', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      email: 'a@teste.com', name: 'A', password: 'hash',
      phone: null, cpf: null, role: 'PASSENGER', otpCode: '123456', otpExpiresAt: futureDate(),
    })
    prismaMock.user.create.mockResolvedValue({
      id: 'u3', name: 'A', email: 'a@teste.com', role: 'PASSENGER', isVerified: true, avatarUrl: null,
    })
    const res = fakeRes()

    const result = await service.verifyOtp({ email: 'a@teste.com', code: '123456' }, res)

    expect(result.accessToken).toBe('access-token')
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-token', expect.any(Object))
    expect(prismaMock.refreshToken.create).toHaveBeenCalled()
  })

  it('rejeita código incorreto', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      email: 'a@teste.com', name: 'A', password: 'hash',
      phone: null, cpf: null, role: 'DRIVER', otpCode: '123456', otpExpiresAt: futureDate(),
    })

    await expect(service.verifyOtp({ email: 'a@teste.com', code: '999999' }, fakeRes()))
      .rejects.toThrow('Código de verificação inválido')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('rejeita código expirado', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      email: 'a@teste.com', name: 'A', password: 'hash',
      phone: null, cpf: null, role: 'DRIVER', otpCode: '123456', otpExpiresAt: pastDate(),
    })

    await expect(service.verifyOtp({ email: 'a@teste.com', code: '123456' }, fakeRes()))
      .rejects.toThrow('expirado')
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  // Regressão de segurança: como verify-otp passou a emitir sessão, o caminho
  // legado não pode servir de login sem senha para uma conta já verificada.
  // Os mocks abaixo são os mesmos do caso legado bem-sucedido (OTP válido e
  // não expirado), então o fluxo emitiria sessão se não fosse barrado por
  // isVerified — é isso que dá valor ao teste, e não a ausência de dados.
  it('não emite sessão para usuário já verificado (login sem senha)', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u9', name: 'Já Verificado', email: 'v@teste.com',
      role: 'DRIVER', isVerified: true, avatarUrl: null,
    })
    prismaMock.otp.findFirst.mockResolvedValue({ code: '123456', expiresAt: futureDate(), userId: 'u9' })
    prismaMock.user.update.mockResolvedValue({
      id: 'u9', name: 'Já Verificado', email: 'v@teste.com',
      role: 'DRIVER', isVerified: true, avatarUrl: null,
    })
    prismaMock.otp.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.driverProfile.findUnique.mockResolvedValue(null)

    await expect(service.verifyOtp({ email: 'v@teste.com', code: '123456' }, fakeRes()))
      .rejects.toThrow('E-mail já verificado')
    // Nada de sessão nem de escrita: o fluxo parou antes de tudo
    expect(prismaMock.refreshToken.create).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.otp.deleteMany).not.toHaveBeenCalled()
  })

  it('usuário legado não verificado conclui e ganha DriverProfile se faltar', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u10', name: 'Legado', email: 'l@teste.com',
      role: 'DRIVER', isVerified: false, avatarUrl: null,
    })
    prismaMock.otp.findFirst.mockResolvedValue({ code: '123456', expiresAt: futureDate(), userId: 'u10' })
    prismaMock.user.update.mockResolvedValue({
      id: 'u10', name: 'Legado', email: 'l@teste.com',
      role: 'DRIVER', isVerified: true, avatarUrl: null,
    })
    prismaMock.otp.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.driverProfile.findUnique.mockResolvedValue(null)

    const result = await service.verifyOtp({ email: 'l@teste.com', code: '123456' }, fakeRes())

    expect(prismaMock.driverProfile.create).toHaveBeenCalledWith({
      data: { userId: 'u10', vehicleStatus: 'PENDING' },
    })
    expect(result.accessToken).toBe('access-token')
  })

  it('usuário legado que já tem perfil não ganha um duplicado', async () => {
    prismaMock.pendingRegistration.findUnique.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u11', name: 'Legado', email: 'l2@teste.com',
      role: 'DRIVER', isVerified: false, avatarUrl: null,
    })
    prismaMock.otp.findFirst.mockResolvedValue({ code: '123456', expiresAt: futureDate(), userId: 'u11' })
    prismaMock.user.update.mockResolvedValue({
      id: 'u11', name: 'Legado', email: 'l2@teste.com',
      role: 'DRIVER', isVerified: true, avatarUrl: null,
    })
    prismaMock.otp.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.driverProfile.findUnique.mockResolvedValue({ id: 'dp1', userId: 'u11' })

    await service.verifyOtp({ email: 'l2@teste.com', code: '123456' }, fakeRes())

    expect(prismaMock.driverProfile.create).not.toHaveBeenCalled()
  })
})

describe('AuthService.login', () => {
  let service: InstanceType<typeof AuthService>

  beforeEach(() => {
    resetPrismaMock()
    service = new AuthService()
    prismaMock.refreshToken.create.mockResolvedValue({})
  })

  it('devolve accessToken e user, sem campo message', async () => {
    const bcrypt = await import('bcrypt')
    const hash = await bcrypt.default.hash('Senha@123', 4)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1', name: 'User', email: 'u@teste.com', password: hash,
      role: 'PASSENGER', isVerified: true, avatarUrl: null,
    })

    const result = await service.login({ email: 'u@teste.com', password: 'Senha@123' }, fakeRes())

    expect(result.accessToken).toBe('access-token')
    expect(result.user.email).toBe('u@teste.com')
    expect('message' in result).toBe(false)
  })

  it('rejeita senha incorreta', async () => {
    const bcrypt = await import('bcrypt')
    const hash = await bcrypt.default.hash('Senha@123', 4)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1', name: 'User', email: 'u@teste.com', password: hash,
      role: 'PASSENGER', isVerified: true, avatarUrl: null,
    })

    await expect(service.login({ email: 'u@teste.com', password: 'errada' }, fakeRes()))
      .rejects.toThrow('Credenciais inválidas')
  })

  // Cadastro parado na confirmação: login deve reconhecer e mandar de volta
  // pra tela de código, em vez do genérico "credenciais inválidas".
  it('reconhece cadastro pendente com senha correta e reenvia o código', async () => {
    const bcrypt = await import('bcrypt')
    const hash = await bcrypt.default.hash('Senha@123', 4)
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      email: 'pendente@teste.com', password: hash, role: 'DRIVER',
      updatedAt: new Date(Date.now() - 5 * 60 * 1000), // fora do rate limit de 60s
    })
    prismaMock.pendingRegistration.update.mockResolvedValue({})

    await expect(service.login({ email: 'pendente@teste.com', password: 'Senha@123' }, fakeRes()))
      .rejects.toMatchObject({
        statusCode: 403,
        details: { reason: 'pending_verification', email: 'pendente@teste.com', role: 'DRIVER' },
      })
    // Reenviou um código novo silenciosamente
    expect(prismaMock.pendingRegistration.update).toHaveBeenCalledWith({
      where: { email: 'pendente@teste.com' },
      data: expect.objectContaining({ otpCode: expect.any(String) }),
    })
  })

  it('cadastro pendente com senha errada continua caindo em credenciais inválidas', async () => {
    const bcrypt = await import('bcrypt')
    const hash = await bcrypt.default.hash('Senha@123', 4)
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      email: 'pendente2@teste.com', password: hash, role: 'DRIVER',
      updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    })

    await expect(service.login({ email: 'pendente2@teste.com', password: 'errada' }, fakeRes()))
      .rejects.toThrow('Credenciais inválidas')
    expect(prismaMock.pendingRegistration.update).not.toHaveBeenCalled()
  })

  it('reenvio silencioso não quebra o login se o rate limit de 60s estiver ativo', async () => {
    const bcrypt = await import('bcrypt')
    const hash = await bcrypt.default.hash('Senha@123', 4)
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.pendingRegistration.findUnique.mockResolvedValue({
      email: 'pendente3@teste.com', password: hash, role: 'DRIVER',
      updatedAt: new Date(), // dentro do rate limit
    })

    await expect(service.login({ email: 'pendente3@teste.com', password: 'Senha@123' }, fakeRes()))
      .rejects.toMatchObject({ statusCode: 403, details: { reason: 'pending_verification' } })
    // Não tenta reenviar (respeitando o rate limit) nem lança 429
    expect(prismaMock.pendingRegistration.update).not.toHaveBeenCalled()
  })
})
