import { Controller, Get, Post, Patch, Body, Param, Query, Inject } from '@nestjs/common';
import { PetsService } from './pets.service';

@Controller('api/pets')
export class PetsController {
  constructor(@Inject(PetsService) private petsService: PetsService) {}

  @Get()
  async findAll(@Query('species') species?: string, @Query('ownerId') ownerId?: string) {
    return this.petsService.findAll(species, ownerId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.petsService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.petsService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.petsService.update(id, body);
  }
}
