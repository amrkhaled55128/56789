import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BoardingService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(petId?: string) {
    const where = petId ? { petId } : {};
    return this.prisma.boarding.findMany({
      where,
      include: { pet: { include: { owner: true } } },
      orderBy: { checkIn: 'desc' },
    });
  }

  async create(data: { petId: string; cageNo: string; dailyRate: number; dailyNotes?: string }) {
    const pet = await this.prisma.pet.findUnique({ where: { id: data.petId } });
    if (!pet) throw new NotFoundException('الحيوان غير موجود');

    return this.prisma.boarding.create({
      data: {
        petId: data.petId,
        cageNo: data.cageNo,
        dailyRate: data.dailyRate,
        dailyNotes: data.dailyNotes,
        checkIn: new Date(),
        status: 'ACTIVE',
      },
      include: { pet: { include: { owner: true } } },
    });
  }

  async checkout(id: string) {
    return this.prisma.boarding.update({
      where: { id },
      data: {
        checkOut: new Date(),
        status: 'COMPLETED',
      },
      include: { pet: { include: { owner: true } } },
    });
  }
}
