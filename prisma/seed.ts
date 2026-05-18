import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  const SENHA = 'Teste@123'
  const hash = await bcrypt.hash(SENHA, 10)

  // ── Admin ──────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@teste.com' },
    update: {},
    create: {
      name: 'Admin Sistema',
      email: 'admin@teste.com',
      password: hash,
      role: 'ADMIN',
      isVerified: true,
      phone: '+55 11 99999-0001',
    },
  })
  console.log('✅ Admin criado:', admin.email)

  // ── Motorista ──────────────────────────────────────────────
  const motorista = await prisma.user.upsert({
    where: { email: 'motorista@teste.com' },
    update: {},
    create: {
      name: 'João Mendes',
      email: 'motorista@teste.com',
      password: hash,
      role: 'DRIVER',
      isVerified: true,
      phone: '+55 11 99999-0002',
      driverProfile: {
        create: {
          bio: 'Motorista profissional com 8 anos de experiência. Especializado em transfers e city tours.',
          vehicleMake: 'BMW',
          vehicleModel: 'Série 5',
          vehicleYear: 2023,
          vehiclePlate: 'ABC-1234',
          vehicleColor: 'Prata',
          vehicleCapacity: 4,
          licenseNumber: 'CNH-12345678',
          licenseExpiry: new Date('2028-12-31'),
          rating: 4.9,
          totalTrips: 312,
          isAvailable: true,
          isApproved: true,
          baseRatePerKm: 4.50,
          baseRatePerHour: 85.00,
        },
      },
    },
  })
  console.log('✅ Motorista criado:', motorista.email)

  // ── Passageiro ─────────────────────────────────────────────
  const passageiro = await prisma.user.upsert({
    where: { email: 'passageiro@teste.com' },
    update: {},
    create: {
      name: 'Ana Clara Silva',
      email: 'passageiro@teste.com',
      password: hash,
      role: 'PASSENGER',
      isVerified: true,
      phone: '+55 11 99999-0003',
    },
  })
  console.log('✅ Passageiro criado:', passageiro.email)

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Seed concluído! Credenciais de teste:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👑 ADMIN     → admin@teste.com       | Teste@123')
  console.log('🚗 MOTORISTA → motorista@teste.com   | Teste@123')
  console.log('👤 PASSAGEIRO→ passageiro@teste.com  | Teste@123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
