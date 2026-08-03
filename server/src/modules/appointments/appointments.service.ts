import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AppointmentsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(dateStr?: string) {
    const where: any = {};
    if (dateStr) {
      const start = new Date(dateStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateStr);
      end.setHours(23, 59, 59, 999);
      where.startsAt = { gte: start, lte: end };
    }
    return this.prisma.appointment.findMany({
      where,
      include: {
        pet: { include: { owner: true, breed: true } },
        visit: true,
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async create(data: { petId: string; vetId?: string; startsAt?: string; scheduledAt?: string; reason?: string; notes?: string }) {
    const pet = await this.prisma.pet.findUnique({ where: { id: data.petId } });
    if (!pet) throw new NotFoundException('الحيوان الأليف غير موجود');

    const scheduledDate = new Date(data.startsAt || data.scheduledAt || Date.now());
    if (data.vetId) {
      const startWindow = new Date(scheduledDate.getTime() - 15 * 60000);
      const endWindow = new Date(scheduledDate.getTime() + 15 * 60000);

      const conflict = await this.prisma.appointment.findFirst({
        where: {
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          startsAt: { gte: startWindow, lte: endWindow },
        },
      });

      if (conflict) {
        throw new BadRequestException('تنبيه تعارض المواعيد: يوجد موعد آخر حجز في هذا التوقيت');
      }
    }

    return this.prisma.appointment.create({
      data: {
        petId: data.petId,
        vetId: data.vetId || undefined,
        startsAt: scheduledDate,
        notes: data.notes || data.reason,
      },
      include: { pet: { include: { owner: true } } },
    });
  }

  async updateStatus(id: string, status: any) {
    const appt = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appt) throw new NotFoundException('الموعد غير موجود');

    return this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: { pet: { include: { owner: true } } },
    });
  }
}
