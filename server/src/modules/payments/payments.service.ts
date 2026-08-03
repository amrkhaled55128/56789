import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.payment.findMany({
      include: { owner: true, invoice: true, createdBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { invoiceId: string; createdById?: string; amount: number; method: any; notes?: string }) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: data.invoiceId } });
    if (!invoice) throw new NotFoundException('الفاتورة غير موجودة');

    const invTotal = Number(invoice.total);
    const invPaid = Number(invoice.paid);
    const remaining = invTotal - invPaid;
    if (data.amount > remaining) {
      throw new BadRequestException(`المبلغ المدفوع يتجاوز الرصيد المستحق على الفاتورة (${remaining} ج.م)`);
    }

    const newPaid = invPaid + data.amount;
    const newStatus = newPaid >= invTotal ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';

    const firstUser = await this.prisma.user.findFirst();
    const createdById = data.createdById || firstUser?.id || '';

    return this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: data.invoiceId },
        data: { paid: newPaid, status: newStatus },
      });

      return tx.payment.create({
        data: {
          invoiceId: data.invoiceId,
          ownerId: invoice.ownerId,
          createdById,
          amount: data.amount,
          method: data.method,
          notes: data.notes,
        },
        include: { owner: true, invoice: true },
      });
    });
  }
}
