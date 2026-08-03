import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VisitsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(petId?: string) {
    const where = petId ? { petId } : {};
    return this.prisma.visit.findMany({
      where,
      include: {
        pet: { include: { owner: true } },
        vet: { select: { id: true, fullName: true, username: true } },
        prescriptions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id },
      include: {
        pet: { include: { owner: true, breed: true } },
        vet: { select: { id: true, fullName: true, username: true } },
        prescriptions: true,
      },
    });
    if (!visit) throw new NotFoundException('السجل الطبي غير موجود');
    return visit;
  }

  async create(data: {
    petId: string;
    vetId?: string;
    chiefComplaint: string;
    history?: string;
    temperature?: number;
    weight?: number;
    heartRate?: number;
    respRate?: number;
    physicalExam?: string;
    diagnosis: string;
    plan: string;
    status?: any;
    followUpAt?: string;
    prescriptions?: Array<{ medicine: string; dosage: string; frequency?: string; durationDays?: number; instructions?: string }>;
  }) {
    const pet = await this.prisma.pet.findUnique({ where: { id: data.petId } });
    if (!pet) throw new NotFoundException('الحيوان الأليف غير موجود');

    const firstUser = await this.prisma.user.findFirst();
    const vetId = data.vetId || firstUser?.id || '';

    const formattedPrescriptions = (data.prescriptions || []).map((p) => ({
      medicine: p.medicine,
      dosage: p.dosage,
      frequency: p.frequency || 'مرتان يومياً',
      durationDays: p.durationDays || 5,
      instructions: p.instructions || '',
    }));

    return this.prisma.$transaction(async (tx) => {
      if (data.weight && data.weight > 0) {
        await tx.pet.update({
          where: { id: data.petId },
          data: { weight: data.weight },
        });
      }

      const visit = await tx.visit.create({
        data: {
          petId: data.petId,
          vetId,
          chiefComplaint: data.chiefComplaint,
          history: data.history,
          temperature: data.temperature,
          weight: data.weight,
          heartRate: data.heartRate,
          respRate: data.respRate,
          physicalExam: data.physicalExam,
          diagnosis: data.diagnosis,
          plan: data.plan,
          status: data.status || 'COMPLETED',
          followUpAt: data.followUpAt ? new Date(data.followUpAt) : undefined,
          prescriptions: {
            create: formattedPrescriptions,
          },
        },
        include: {
          pet: { include: { owner: true } },
          vet: { select: { id: true, fullName: true } },
          prescriptions: true,
        },
      });

      return visit;
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.visit.update({
      where: { id },
      data,
      include: { pet: true, prescriptions: true },
    });
  }
}
