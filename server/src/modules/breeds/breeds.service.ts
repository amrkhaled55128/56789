import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BreedsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(species?: string) {
    const where: any = {};
    if (species && (species === 'CAT' || species === 'DOG')) {
      where.species = species;
    }
    return this.prisma.breed.findMany({
      where,
      orderBy: { nameAr: 'asc' },
    });
  }

  async create(data: { species: any; nameEn: string; nameAr: string }) {
    return this.prisma.breed.create({ data });
  }
}
