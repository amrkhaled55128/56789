import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.product.findMany({
      include: { supplier: true, stockMovements: { take: 5, orderBy: { createdAt: 'desc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const prd = await this.prisma.product.findUnique({
      where: { id },
      include: { supplier: true, stockMovements: { orderBy: { createdAt: 'desc' } } },
    });
    if (!prd) throw new NotFoundException('الصنف غير موجود بالمخزون');
    return prd;
  }

  async create(data: {
    sku: string;
    name: string;
    category?: any;
    unit?: string;
    costPrice: number;
    sellPrice: number;
    stockQty: number;
    reorderLevel?: number;
    expiryDate?: string;
    supplierId?: string;
  }) {
    const existing = await this.prisma.product.findUnique({ where: { sku: data.sku } });
    if (existing) throw new BadRequestException('كود SKU مسجل مسبقاً لصنف آخر');

    return this.prisma.product.create({
      data: {
        ...data,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    });
  }

  async createMovement(data: { productId: string; userId?: string; type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason: string }) {
    const prd = await this.findOne(data.productId);

    let newStock = prd.stockQty;
    if (data.type === 'IN') newStock += data.quantity;
    if (data.type === 'OUT') newStock -= data.quantity;
    if (data.type === 'ADJUST') newStock = data.quantity;

    if (newStock < 0) throw new BadRequestException('الرصيد المتبقي لا يكفي لإتمام عملية الصرف');

    const firstUser = await this.prisma.user.findFirst();
    const userId = data.userId || firstUser?.id || '';

    return this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: data.productId },
        data: { stockQty: newStock },
      });

      return tx.stockMovement.create({
        data: {
          productId: data.productId,
          userId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
        },
      });
    });
  }
}
