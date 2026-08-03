import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Species } from '../../common/types';

@Injectable()
export class VaccinesService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(species?: string) {
    const where: any = {};
    if (species && (species === 'CAT' || species === 'DOG')) {
      where.species = species;
    }
    return this.prisma.vaccine.findMany({
      where,
      orderBy: { expiryDate: 'asc' },
    });
  }

  async create(data: { name: string; species: Species; manufacturer?: string; batchNo: string; expiryDate: string; price: number; stockQty: number }) {
    if (data.species !== 'CAT' && data.species !== 'DOG') {
      throw new BadRequestException('اللقاحات مدعومة فقط للنوعين CAT (القطط) و DOG (الكلاب)');
    }
    return this.prisma.vaccine.create({
      data: {
        ...data,
        expiryDate: new Date(data.expiryDate),
      },
    });
  }

  async update(id: string, data: any) {
    const v = await this.prisma.vaccine.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('اللقاح غير موجود');

    return this.prisma.vaccine.update({
      where: { id },
      data: {
        ...data,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    });
  }
}
