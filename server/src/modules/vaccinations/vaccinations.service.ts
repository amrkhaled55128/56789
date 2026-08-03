import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class VaccinationsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(petId?: string) {
    const where = petId ? { petId } : {};
    return this.prisma.vaccination.findMany({
      where,
      include: {
        pet: { include: { owner: true, breed: true } },
        vaccine: true,
        givenBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { givenAt: 'desc' },
    });
  }

  async create(data: {
    petId: string;
    vaccineId: string;
    givenByVetId: string;
    doseNumber?: number;
    customNextDueAt?: string;
  }) {
    const pet = await this.prisma.pet.findUnique({ where: { id: data.petId } });
    if (!pet) throw new NotFoundException('الحيوان الأليف غير موجود');

    const vaccine = await this.prisma.vaccine.findUnique({ where: { id: data.vaccineId } });
    if (!vaccine) throw new NotFoundException('اللقاح غير موجود');

    if (vaccine.species !== pet.species) {
      const speciesNames: Record<string, string> = { CAT: 'القطط', DOG: 'الكلاب' };
      const vSpecName = speciesNames[vaccine.species] || vaccine.species;
      const pSpecName = speciesNames[pet.species] || pet.species;
      throw new BadRequestException(
        `خطأ في البروتوكول الطبي: لا يمكن إعطاء لقاح خاص بـ (${vSpecName}) لـ (${pSpecName})`,
      );
    }

    if (new Date(vaccine.expiryDate) < new Date()) {
      throw new BadRequestException(`فشل الصرف: اللقاح منتهي الصلاحية بتاريخ ${new Date(vaccine.expiryDate).toLocaleDateString('ar-EG')}`);
    }

    if (vaccine.stockQty <= 0) {
      throw new BadRequestException('نفدت كمية هذا اللقاح من المخزون');
    }

    let nextDueAt: Date | null = null;
    if (data.customNextDueAt) {
      nextDueAt = new Date(data.customNextDueAt);
    } else {
      const doseNum = data.doseNumber || 1;
      const daysToAdd = doseNum < 3 ? 21 : 365;
      nextDueAt = new Date(Date.now() + daysToAdd * 24 * 3600 * 1000);
    }

    const certificateNo = `VACC-${pet.species}-${Date.now().toString().slice(-6)}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.vaccine.update({
        where: { id: vaccine.id },
        data: { stockQty: { decrement: 1 } },
      });

      const vaccination = await tx.vaccination.create({
        data: {
          petId: data.petId,
          vaccineId: data.vaccineId,
          givenByVetId: data.givenByVetId,
          givenAt: new Date(),
          nextDueAt,
          doseNumber: data.doseNumber || 1,
          certificateNo,
        },
        include: {
          pet: { include: { owner: true, breed: true } },
          vaccine: true,
          givenBy: { select: { id: true, fullName: true, username: true } },
        },
      });

      if (nextDueAt) {
        await tx.notification.create({
          data: {
            type: 'VACCINE_DUE',
            title: `تطعيم مستحق: ${pet.name} (${vaccine.name})`,
            message: `موعد الجرعة القادمة لـ ${pet.name} هو ${nextDueAt.toLocaleDateString('ar-EG')}`,
            targetDate: nextDueAt,
          },
        });
      }

      return vaccination;
    });
  }
}
