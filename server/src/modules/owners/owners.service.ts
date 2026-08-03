import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OwnersService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(query?: string) {
    if (query) {
      return this.prisma.owner.findMany({
        where: {
          OR: [
            { fullName: { contains: query } },
            { phone: { contains: query } },
            { altPhone: { contains: query } },
          ],
        },
        include: { pets: true, invoices: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.owner.findMany({
      include: { pets: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const owner = await this.prisma.owner.findUnique({
      where: { id },
      include: {
        pets: {
          include: {
            breed: true,
            visits: { orderBy: { createdAt: 'desc' }, take: 5 },
            vaccinations: { include: { vaccine: true }, orderBy: { givenAt: 'desc' } },
          },
        },
        invoices: { include: { items: true, payments: true }, orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!owner) throw new NotFoundException('العميل غير موجود');
    return owner;
  }

  async create(data: { fullName: string; phone: string; altPhone?: string; email?: string; address?: string; nationalId?: string; notes?: string }) {
    const existing = await this.prisma.owner.findUnique({ where: { phone: data.phone } });
    if (existing) {
      throw new BadRequestException('رقم الهاتف مسجل بالفعل لعميل آخر');
    }
    return this.prisma.owner.create({ data });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.owner.update({ where: { id }, data });
  }
}
