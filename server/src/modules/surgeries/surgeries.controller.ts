import { Controller, Get, Post, Patch, Body, Param, Query, Inject } from '@nestjs/common';
import { SurgeriesService } from './surgeries.service';

@Controller('api/surgeries')
export class SurgeriesController {
  constructor(@Inject(SurgeriesService) private surgeriesService: SurgeriesService) {}

  @Get()
  async findAll(@Query('petId') petId?: string) {
    return this.surgeriesService.findAll(petId);
  }

  @Post()
  async create(@Body() body: any) {
    return this.surgeriesService.create(body);
  }

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.surgeriesService.updateStatus(id, status);
  }
}
