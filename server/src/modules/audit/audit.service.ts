import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.auditLog.findMany({
      include: { user: { select: { id: true, fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
