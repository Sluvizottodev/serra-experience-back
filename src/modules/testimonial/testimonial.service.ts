import { prisma } from '../../common/config/prisma'
import type { Prisma } from '@prisma/client'

export class TestimonialService {
  listPublic() {
    return prisma.testimonial.findMany({
      where: { active: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
  }

  listAll() {
    return prisma.testimonial.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
  }

  create(data: Prisma.TestimonialCreateInput) {
    return prisma.testimonial.create({ data })
  }

  update(id: string, data: Prisma.TestimonialUpdateInput) {
    return prisma.testimonial.update({ where: { id }, data })
  }

  delete(id: string) {
    return prisma.testimonial.delete({ where: { id } })
  }
}
