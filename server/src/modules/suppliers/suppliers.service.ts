import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.supplier.findMany({
      include: { products: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; contactPerson?: string; phone: string; address?: string }) {
    return this.prisma.supplier.create({ data });
  }

  async update(id: string, data: any) {
    const s = await this.prisma.supplier.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('المورد غير موجود');
    return this.prisma.supplier.update({ where: { id }, data });
  }
}
