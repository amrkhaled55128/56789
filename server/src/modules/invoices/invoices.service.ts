import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.invoice.findMany({
      include: {
        owner: true,
        pet: true,
        items: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        owner: true,
        pet: { include: { breed: true } },
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!inv) throw new NotFoundException('الفاتورة غير موجودة');
    return inv;
  }

  async create(data: {
    ownerId: string;
    createdById?: string;
    petId?: string;
    subtotal: number;
    discount?: number;
    tax?: number;
    items: Array<{ productId?: string; description: string; quantity: number; unitPrice: number }>;
  }) {
    const owner = await this.prisma.owner.findUnique({ where: { id: data.ownerId } });
    if (!owner) throw new NotFoundException('العميل غير موجود');

    const firstUser = await this.prisma.user.findFirst();
    const createdById = data.createdById || firstUser?.id || '';

    const discount = data.discount || 0;
    const tax = data.tax || 0;
    const total = Math.max(0, data.subtotal - discount + tax);
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;

    return this.prisma.$transaction(async (tx) => {
      for (const item of data.items) {
        if (item.productId) {
          const prd = await tx.product.findUnique({ where: { id: item.productId } });
          if (prd && prd.stockQty < item.quantity) {
            throw new BadRequestException(`كمية غير كافية بالمخزون للصنف (${prd.name}). المتبقي: ${prd.stockQty}`);
          }
          if (prd) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQty: { decrement: item.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                userId: createdById,
                type: 'OUT',
                quantity: item.quantity,
                reason: `فاتورة مبيعات ${invoiceNo}`,
              },
            });
          }
        }
      }

      const invoice = await tx.invoice.create({
        data: {
          invoiceNo,
          ownerId: data.ownerId,
          createdById,
          petId: data.petId || undefined,
          subtotal: data.subtotal,
          discount,
          tax,
          total,
          paid: 0,
          status: 'UNPAID',
          items: {
            create: data.items.map((i) => ({
              productId: i.productId || undefined,
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.quantity * i.unitPrice,
            })),
          },
        },
        include: { owner: true, pet: true, items: true },
      });

      return invoice;
    });
  }
}
