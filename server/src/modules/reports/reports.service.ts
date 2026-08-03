import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getDashboardMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      ownersCount,
      catsCount,
      dogsCount,
      todayAppointments,
      lowStockProducts,
      recentVisits,
      recentVaccinations,
    ] = await Promise.all([
      this.prisma.owner.count(),
      this.prisma.pet.count({ where: { species: 'CAT' } }),
      this.prisma.pet.count({ where: { species: 'DOG' } }),
      this.prisma.appointment.findMany({
        where: { startsAt: { gte: today } },
        include: { pet: { include: { owner: true } } },
        take: 10,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.product.findMany({
        where: { stockQty: { lte: 5 } },
        take: 5,
      }),
      this.prisma.visit.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { pet: { include: { owner: true } }, vet: { select: { fullName: true } } },
      }),
      this.prisma.vaccination.findMany({
        take: 5,
        orderBy: { givenAt: 'desc' },
        include: { pet: { include: { owner: true } }, vaccine: true },
      }),
    ]);

    return {
      stats: {
        ownersCount,
        petsCount: catsCount + dogsCount,
        catsCount,
        dogsCount,
      },
      todayAppointments,
      lowStockProducts,
      recentVisits,
      recentVaccinations,
    };
  }

  async getFinancialReport() {
    const invoices = await this.prisma.invoice.findMany({
      include: { owner: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.paid), 0);
    const totalOutstanding = totalBilled - totalPaid;

    return {
      summary: {
        totalBilled,
        totalPaid,
        totalOutstanding,
      },
      invoices,
    };
  }
}
