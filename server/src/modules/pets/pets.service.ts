import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Species, Sex } from '../../common/types';

@Injectable()
export class PetsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findAll(species?: string, ownerId?: string) {
    const where: any = {};
    if (species && (species === 'CAT' || species === 'DOG')) {
      where.species = species;
    }
    if (ownerId) {
      where.ownerId = ownerId;
    }
    return this.prisma.pet.findMany({
      where,
      include: {
        owner: true,
        breed: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        owner: true,
        breed: true,
        visits: {
          include: { vet: { select: { id: true, fullName: true } }, prescriptions: true },
          orderBy: { createdAt: 'desc' },
        },
        vaccinations: {
          include: { vaccine: true, givenBy: { select: { id: true, fullName: true } } },
          orderBy: { givenAt: 'desc' },
        },
        surgeries: { orderBy: { createdAt: 'desc' } },
        labTests: { orderBy: { createdAt: 'desc' } },
        boardings: { orderBy: { checkIn: 'desc' } },
      },
    });
    if (!pet) throw new NotFoundException('الحيوان الأليف غير موجود');
    return pet;
  }

  async create(data: {
    ownerId: string;
    name: string;
    species: Species;
    breedId?: string;
    sex: Sex;
    isNeutered?: boolean;
    dob?: string;
    birthDate?: string;
    color?: string;
    microchip?: string;
    weight?: number;
    notes?: string;
  }) {
    if (data.species !== 'CAT' && data.species !== 'DOG') {
      throw new BadRequestException('الأنواع المدعومة هي CAT (قطة) و DOG (كلب) فقط');
    }
    const owner = await this.prisma.owner.findUnique({ where: { id: data.ownerId } });
    if (!owner) throw new NotFoundException('العميل/المالك غير موجود');

    const bDate = data.birthDate || data.dob || new Date().toISOString();

    return this.prisma.pet.create({
      data: {
        ownerId: data.ownerId,
        name: data.name,
        species: data.species,
        breedId: data.breedId || undefined,
        sex: data.sex,
        isNeutered: data.isNeutered || false,
        birthDate: new Date(bDate),
        color: data.color,
        microchip: data.microchip || undefined,
        weight: data.weight,
      },
      include: { owner: true, breed: true },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    if (data.species && data.species !== 'CAT' && data.species !== 'DOG') {
      throw new BadRequestException('الأنواع المدعومة هي CAT (قطة) و DOG (كلب) فقط');
    }
    const updateData = { ...data };
    if (data.dob || data.birthDate) {
      updateData.birthDate = new Date(data.birthDate || data.dob);
      delete updateData.dob;
    }
    return this.prisma.pet.update({
      where: { id },
      data: updateData,
      include: { owner: true, breed: true },
    });
  }
}
