import { Controller, Get, Post, Patch, Body, Param, Query, Inject } from '@nestjs/common';
import { LabsService } from './labs.service';

@Controller('api/labs')
export class LabsController {
  constructor(@Inject(LabsService) private labsService: LabsService) {}

  @Get()
  async findAll(@Query('petId') petId?: string) {
    return this.labsService.findAll(petId);
  }

  @Post()
  async create(@Body() body: any) {
    return this.labsService.create(body);
  }

  @Patch(':id')
  async updateResult(@Param('id') id: string, @Body() body: any) {
    return this.labsService.updateResult(id, body);
  }
}
