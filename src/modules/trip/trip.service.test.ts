import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prismaMock, resetPrismaMock } from '../../test/prisma.mock'
import { TripService } from './trip.service'

vi.mock('../../common/config/prisma', () => ({ prisma: prismaMock }))
vi.mock('../../common/config/queue', () => ({ enqueueNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../common/config/mailer', () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../common/utils/notify-admins', () => ({ notifyAdmins: vi.fn().mockResolvedValue(undefined) }))

const baseProfile = {
  id: 'driver-profile-1',
  userId: 'driver-user-1',
  licenseExpiry: null,
  vehicleMake: 'Fiat',
  vehicleModel: 'Uno',
  vehiclePlate: 'ABC1234',
  user: { name: 'Motorista Teste', email: 'motorista@teste.com' },
}

const baseTrip = {
  id: 'trip-1',
  quoteId: 'quote-1',
  driverProfileId: 'driver-profile-1',
  status: 'PENDING',
  originAddress: 'Origem',
  destinationAddress: 'Destino',
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  paymentStatus: 'PENDING',
  passenger: { name: 'Passageiro Teste', email: 'passageiro@teste.com' },
}

describe('TripService.updateTripStatus', () => {
  let service: InstanceType<typeof TripService>

  beforeEach(() => {
    resetPrismaMock()
    service = new TripService()
  })

  it('permite a transição PENDING -> CONFIRMED', async () => {
    prismaMock.driverProfile.findUnique.mockResolvedValue(baseProfile)
    prismaMock.trip.findUnique.mockResolvedValue({ ...baseTrip, status: 'PENDING' })
    prismaMock.trip.update.mockResolvedValue({ ...baseTrip, status: 'CONFIRMED' })

    const result = await service.updateTripStatus('trip-1', 'driver-user-1', { status: 'CONFIRMED' })

    expect(result.status).toBe('CONFIRMED')
    expect(prismaMock.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip-1' },
      data: { status: 'CONFIRMED' },
    })
  })

  it('rejeita transição inválida PENDING -> IN_PROGRESS', async () => {
    prismaMock.driverProfile.findUnique.mockResolvedValue(baseProfile)
    prismaMock.trip.findUnique.mockResolvedValue({ ...baseTrip, status: 'PENDING' })

    await expect(
      service.updateTripStatus('trip-1', 'driver-user-1', { status: 'IN_PROGRESS' })
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(prismaMock.trip.update).not.toHaveBeenCalled()
  })

  it('rejeita transição a partir de estado terminal (COMPLETED -> CONFIRMED)', async () => {
    prismaMock.driverProfile.findUnique.mockResolvedValue(baseProfile)
    prismaMock.trip.findUnique.mockResolvedValue({ ...baseTrip, status: 'COMPLETED' })

    await expect(
      service.updateTripStatus('trip-1', 'driver-user-1', { status: 'CONFIRMED' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('bloqueia CONFIRMED quando a CNH do motorista está vencida', async () => {
    prismaMock.driverProfile.findUnique.mockResolvedValue({
      ...baseProfile,
      licenseExpiry: new Date('2020-01-01'),
    })
    prismaMock.trip.findUnique.mockResolvedValue({ ...baseTrip, status: 'PENDING' })

    await expect(
      service.updateTripStatus('trip-1', 'driver-user-1', { status: 'CONFIRMED' })
    ).rejects.toMatchObject({ statusCode: 403 })

    expect(prismaMock.trip.update).not.toHaveBeenCalled()
  })

  it('recusar viagem (PENDING -> CANCELLED) reabre o quote associado', async () => {
    prismaMock.driverProfile.findUnique.mockResolvedValue(baseProfile)
    prismaMock.trip.findUnique.mockResolvedValue({ ...baseTrip, status: 'PENDING' })

    type TxMock = {
      trip: { update: ReturnType<typeof vi.fn> }
      quote: { update: ReturnType<typeof vi.fn> }
    }
    const tx: TxMock = {
      trip: { update: vi.fn().mockResolvedValue({ ...baseTrip, status: 'CANCELLED' }) },
      quote: { update: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx))

    const result = await service.updateTripStatus('trip-1', 'driver-user-1', {
      status: 'CANCELLED',
      cancelReason: 'Motivo válido',
    })

    expect(result.status).toBe('CANCELLED')
    expect(tx.quote.update).toHaveBeenCalledWith({
      where: { id: 'quote-1' },
      data: { status: 'OPEN', driverProfileId: null, assignToken: null, assignExpiresAt: null },
    })
  })

  it('rejeita quando o motorista não é dono da viagem', async () => {
    prismaMock.driverProfile.findUnique.mockResolvedValue(baseProfile)
    prismaMock.trip.findUnique.mockResolvedValue({ ...baseTrip, driverProfileId: 'outro-profile' })

    await expect(
      service.updateTripStatus('trip-1', 'driver-user-1', { status: 'CONFIRMED' })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('lança 404 quando a viagem não existe', async () => {
    prismaMock.driverProfile.findUnique.mockResolvedValue(baseProfile)
    prismaMock.trip.findUnique.mockResolvedValue(null)

    await expect(
      service.updateTripStatus('trip-inexistente', 'driver-user-1', { status: 'CONFIRMED' })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
