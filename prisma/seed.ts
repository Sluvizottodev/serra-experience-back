import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  const SENHA = 'Teste@123'
  const hash = await bcrypt.hash(SENHA, 10)

  // ── Settings ────────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      siteName: 'Serra Experience',
      contactEmail: 'contato@viagem-motorista.com',
      commissionRate: 0.10,
      timezone: 'America/Sao_Paulo',
    },
  })
  console.log('✅ Settings configurado')

  // ── Admin ────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@teste.com' },
    update: {},
    create: {
      name: 'Admin Sistema',
      email: 'admin@teste.com',
      password: hash,
      role: 'ADMIN',
      isVerified: true,
      phone: '+55 21 97368-7706',
      cpf: '00000000001',
    },
  })
  console.log('✅ Admin criado:', admin.email)

  // ── Passageiro ───────────────────────────────────────────────
  const passageiro = await prisma.user.upsert({
    where: { email: 'cliente@teste.com' },
    update: {},
    create: {
      name: 'Ana Clara Silva',
      email: 'cliente@teste.com',
      password: hash,
      role: 'PASSENGER',
      isVerified: true,
      phone: '11999990002',
      cpf: '00000000002',
    },
  })
  console.log('✅ Passageiro criado:', passageiro.email)

  // ── Motorista 1 — Executivo ──────────────────────────────────
  const m1User = await prisma.user.upsert({
    where: { email: 'joao.mendes@teste.com' },
    update: {},
    create: {
      name: 'João Mendes',
      email: 'joao.mendes@teste.com',
      password: hash,
      role: 'DRIVER',
      isVerified: true,
      phone: '11999990003',
      cpf: '00000000003',
    },
  })

  const m1Profile = await prisma.driverProfile.upsert({
    where: { userId: m1User.id },
    update: {},
    create: {
      userId: m1User.id,
      bio: 'Motorista executivo com 10 anos de experiência. Especializado em transfers aeroporto e reuniões corporativas. Frota premium, WiFi a bordo e água inclusa.',
      vehicleMake: 'BMW',
      vehicleModel: 'Série 5',
      vehicleYear: 2023,
      vehiclePlate: 'ABC1234',
      vehicleColor: 'Prata',
      vehicleCapacity: 4,
      licenseNumber: 'CNH12345678',
      licenseExpiry: new Date('2029-06-30'),
      rating: 4.9,
      totalTrips: 312,
      isAvailable: true,
      isApproved: true,
      baseRatePerKm: 4.50,
      baseRatePerHour: 90.00,
    },
  })
  console.log('✅ Motorista 1 criado:', m1User.email)

  // ── Motorista 2 — Van / Grupos ───────────────────────────────
  const m2User = await prisma.user.upsert({
    where: { email: 'carlos.souza@teste.com' },
    update: {},
    create: {
      name: 'Carlos Souza',
      email: 'carlos.souza@teste.com',
      password: hash,
      role: 'DRIVER',
      isVerified: true,
      phone: '11999990004',
      cpf: '00000000004',
    },
  })

  const m2Profile = await prisma.driverProfile.upsert({
    where: { userId: m2User.id },
    update: {},
    create: {
      userId: m2User.id,
      bio: 'Especialista em transporte de grupos e excursões. Van executiva com ar condicionado, cadeiras reclináveis e espaço para bagagem. Atendo empresas e eventos.',
      vehicleMake: 'Mercedes-Benz',
      vehicleModel: 'Sprinter',
      vehicleYear: 2022,
      vehiclePlate: 'DEF5678',
      vehicleColor: 'Branca',
      vehicleCapacity: 10,
      licenseNumber: 'CNH87654321',
      licenseExpiry: new Date('2028-03-15'),
      rating: 4.7,
      totalTrips: 189,
      isAvailable: true,
      isApproved: true,
      baseRatePerKm: 6.00,
      baseRatePerHour: 120.00,
    },
  })
  console.log('✅ Motorista 2 criado:', m2User.email)

  // ── Motorista 3 — Econômico ───────────────────────────────────
  const m3User = await prisma.user.upsert({
    where: { email: 'fernanda.lima@teste.com' },
    update: {},
    create: {
      name: 'Fernanda Lima',
      email: 'fernanda.lima@teste.com',
      password: hash,
      role: 'DRIVER',
      isVerified: true,
      phone: '11999990005',
      cpf: '00000000005',
    },
  })

  const m3Profile = await prisma.driverProfile.upsert({
    where: { userId: m3User.id },
    update: {},
    create: {
      userId: m3User.id,
      bio: 'Motorista profissional com 5 anos de experiência. Pontual, discreta e atenciosa. Atendo também pacientes e idosos com cuidado especial.',
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehicleYear: 2021,
      vehiclePlate: 'GHI9012',
      vehicleColor: 'Preto',
      vehicleCapacity: 4,
      licenseNumber: 'CNH11223344',
      licenseExpiry: new Date('2027-09-20'),
      rating: 4.8,
      totalTrips: 97,
      isAvailable: true,
      isApproved: true,
      baseRatePerKm: 3.20,
      baseRatePerHour: 65.00,
    },
  })
  console.log('✅ Motorista 3 criado:', m3User.email)

  // ── Disponibilidades ──────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const availDays = [0, 1, 2, 3, 4, 5, 6].map(offset => {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    return d
  })

  for (const profile of [m1Profile, m2Profile, m3Profile]) {
    for (const date of availDays) {
      const existing = await prisma.availability.findFirst({
        where: { driverProfileId: profile.id, date },
      })
      if (!existing) {
        await prisma.availability.create({
          data: {
            driverProfileId: profile.id,
            date,
            startTime: '07:00',
            endTime: '22:00',
            isAvailable: true,
          },
        })
      }
    }
  }
  console.log('✅ Disponibilidades criadas (7 dias)')

  // ── Orçamento aberto (passageiro pediu, aguardando proposta) ──
  const futureDate1 = new Date()
  futureDate1.setDate(futureDate1.getDate() + 3)
  futureDate1.setHours(10, 0, 0, 0)

  const expiresAt1 = new Date()
  expiresAt1.setHours(expiresAt1.getHours() + 48)

  const quoteOpen = await prisma.quote.upsert({
    where: { id: 'seed-quote-open-0001' },
    update: {},
    create: {
      id: 'seed-quote-open-0001',
      passengerId: passageiro.id,
      originAddress: 'Av. Paulista, 1000 — São Paulo, SP',
      destinationAddress: 'Aeroporto Internacional de Guarulhos — GRU',
      scheduledAt: futureDate1,
      passengerCount: 2,
      notes: 'Tenho 2 malas grandes. Preciso chegar com 2h de antecedência.',
      status: 'OPEN',
      expiresAt: expiresAt1,
    },
  })

  // ── Orçamento respondido (motorista já enviou proposta) ────────
  const futureDate2 = new Date()
  futureDate2.setDate(futureDate2.getDate() + 5)
  futureDate2.setHours(14, 30, 0, 0)

  const expiresAt2 = new Date()
  expiresAt2.setHours(expiresAt2.getHours() + 48)

  const quoteResponded = await prisma.quote.upsert({
    where: { id: 'seed-quote-resp-0001' },
    update: {},
    create: {
      id: 'seed-quote-resp-0001',
      passengerId: passageiro.id,
      driverProfileId: m1Profile.id,
      originAddress: 'Rua Augusta, 500 — São Paulo, SP',
      destinationAddress: 'Hotel Unique, Jardins — São Paulo, SP',
      scheduledAt: futureDate2,
      passengerCount: 1,
      notes: 'Reunião de negócios, preciso de veículo executivo.',
      status: 'RESPONDED',
      responsePrice: 180.00,
      responseNote: 'Incluo água e WiFi. Veículo BMW Série 5 prata.',
      expiresAt: expiresAt2,
    },
  })

  // ── Viagem concluída com review ───────────────────────────────
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 7)
  pastDate.setHours(9, 0, 0, 0)

  const expiresAtPast = new Date(pastDate)
  expiresAtPast.setHours(expiresAtPast.getHours() + 48)

  const quoteAccepted = await prisma.quote.upsert({
    where: { id: 'seed-quote-done-0001' },
    update: {},
    create: {
      id: 'seed-quote-done-0001',
      passengerId: passageiro.id,
      driverProfileId: m3Profile.id,
      originAddress: 'Rua Oscar Freire, 900 — São Paulo, SP',
      destinationAddress: 'Shopping Iguatemi — São Paulo, SP',
      scheduledAt: pastDate,
      passengerCount: 1,
      status: 'ACCEPTED',
      responsePrice: 95.00,
      responseNote: 'Toyota Corolla preto, pontual e discreto.',
      expiresAt: expiresAtPast,
    },
  })

  const tripCompleted = await prisma.trip.upsert({
    where: { quoteId: quoteAccepted.id },
    update: {},
    create: {
      passengerId: passageiro.id,
      driverProfileId: m3Profile.id,
      quoteId: quoteAccepted.id,
      originAddress: 'Rua Oscar Freire, 900 — São Paulo, SP',
      destinationAddress: 'Shopping Iguatemi — São Paulo, SP',
      scheduledAt: pastDate,
      totalPrice: 104.50,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      estimatedDistanceKm: 12.5,
      estimatedDurationMinutes: 35,
    },
  })

  const existingReview = await prisma.review.findUnique({ where: { tripId: tripCompleted.id } })
  if (!existingReview) {
    await prisma.review.create({
      data: {
        tripId: tripCompleted.id,
        authorId: passageiro.id,
        driverProfileId: m3Profile.id,
        rating: 5,
        comment: 'Fernanda é excelente! Pontual, educada e o carro estava impecável. Super recomendo!',
      },
    })
  }
  console.log('✅ Viagem concluída + review criados')

  // ── Mensagem no orçamento respondido ──────────────────────────
  const existingMsg = await prisma.message.findFirst({ where: { quoteId: quoteResponded.id } })
  if (!existingMsg) {
    await prisma.message.createMany({
      data: [
        {
          quoteId: quoteResponded.id,
          senderId: passageiro.id,
          content: 'Olá! Tem estacionamento disponível no local de origem?',
        },
        {
          quoteId: quoteResponded.id,
          senderId: m1User.id,
          content: 'Olá Ana Clara! Sim, há estacionamento na Rua Augusta. Vou aguardar no local combinado.',
        },
      ],
    })
  }
  console.log('✅ Mensagens de negociação criadas')

  // ── Resumo ────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Seed concluído! Credenciais de teste:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('👑 ADMIN      → admin@teste.com            | Teste@123')
  console.log('👤 CLIENTE    → cliente@teste.com          | Teste@123')
  console.log('🚗 MOTORISTA 1→ joao.mendes@teste.com      | Teste@123  (BMW Série 5 — Executivo)')
  console.log('🚗 MOTORISTA 2→ carlos.souza@teste.com     | Teste@123  (Mercedes Sprinter — Grupos)')
  console.log('🚗 MOTORISTA 3→ fernanda.lima@teste.com    | Teste@123  (Toyota Corolla — Econômico)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 Orçamentos criados:')
  console.log('   • OPEN      — aguardando proposta de motorista')
  console.log('   • RESPONDED — João propôs R$ 180,00 (aceitar ou rejeitar)')
  console.log('   • ACCEPTED  — viagem concluída + avaliação 5 estrelas')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
