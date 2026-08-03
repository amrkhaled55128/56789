import { Controller, Get, Post, Body, Query, Req, Inject } from '@nestjs/common';
import { VaccinationsService } from './vaccinations.service';

@Controller('api/vaccinations')
export class VaccinationsController {
  constructor(@Inject(VaccinationsService) private vaccinationsService: VaccinationsService) {}

  @Get()
  async findAll(@Query('petId') petId?: string) {
    return this.vaccinationsService.findAll(petId);
  }

  @Post()
  async create(@Req() req: any, @Body() body: { petId: string; vaccineId: string; doseNumber?: number; customNextDueAt?: string }) {
    const vetId = req.user?.id;
    return this.vaccinationsService.create({ ...body, givenByVetId: vetId });
  }
}
