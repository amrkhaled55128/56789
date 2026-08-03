import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LabsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(petId?: string) {
    const where = petId ? { petId } : {};
    return this.prisma.labTest.findMany({
      where,
      include: { pet: { include: { owner: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { petId: string; testName: string; sampleType?: string; referenceRange?: string }) {
    const pet = await this.prisma.pet.findUnique({ where: { id: data.petId } });
    if (!pet) throw new NotFoundException('الحيوان غير موجود');

    return this.prisma.labTest.create({
      data: {
        petId: data.petId,
        testName: data.testName,
        sampleType: data.sampleType,
        referenceRange: data.referenceRange,
        status: 'PENDING',
      },
      include: { pet: { include: { owner: true } } },
    });
  }

  async updateResult(id: string, data: { result?: string; status?: any }) {
    return this.prisma.labTest.update({
      where: { id },
      data,
      include: { pet: { include: { owner: true } } },
    });
  }
}
