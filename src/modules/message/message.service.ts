import { prisma } from '../../common/config/prisma';
import { AppError } from '../../common/middlewares/error.middleware';

export class MessageService {
  private async findQuoteAndCheckAccess(quoteId: string, userId: string) {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { driverProfile: { select: { userId: true } } },
    })
    if (!quote) throw new AppError(404, 'Orçamento não encontrado')

    const isPassenger = quote.passengerId === userId
    const isDriver = quote.driverProfile?.userId === userId
    if (!isPassenger && !isDriver) throw new AppError(403, 'Você não tem acesso a este orçamento')

    return quote
  }

  async getMessagesByQuote(quoteId: string, userId: string) {
    await this.findQuoteAndCheckAccess(quoteId, userId)

    return prisma.message.findMany({
      where: { quoteId },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async sendMessage(quoteId: string, senderId: string, content: string) {
    const quote = await this.findQuoteAndCheckAccess(quoteId, senderId)

    if (['ACCEPTED', 'REJECTED', 'EXPIRED'].includes(quote.status)) {
      throw new AppError(400, 'Não é possível enviar mensagens em um orçamento fechado')
    }

    return prisma.message.create({
      data: { content, quoteId, senderId },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    })
  }
}
