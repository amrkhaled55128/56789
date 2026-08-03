import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SurgeriesService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(petId?: string) {
    const where = petId ? { petId } : {};
    return this.prisma.surgery.findMany({
      where,
      include: { pet: { include: { owner: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { petId: string; procedureName: string; anesthesia?: string; team?: string; postOpNotes?: string }) {
    const pet = await this.prisma.pet.findUnique({ where: { id: data.petId } });
    if (!pet) throw new NotFoundException('الحيوان غير موجود');

    return this.prisma.surgery.create({
      data: {
        petId: data.petId,
        procedureName: data.procedureName,
        anesthesia: data.anesthesia,
        team: data.team,
        postOpNotes: data.postOpNotes,
        status: 'SCHEDULED',
      },
      include: { pet: { include: { owner: true } } },
    });
  }

  async updateStatus(id: string, status: any) {
    return this.prisma.surgery.update({
      where: { id },
      data: { status },
      include: { pet: { include: { owner: true } } },
    });
  }
}
