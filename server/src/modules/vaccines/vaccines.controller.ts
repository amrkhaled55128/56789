import { Controller, Get, Post, Patch, Body, Param, Query, Inject } from '@nestjs/common';
import { VaccinesService } from './vaccines.service';

@Controller('api/vaccines')
export class VaccinesController {
  constructor(@Inject(VaccinesService) private vaccinesService: VaccinesService) {}

  @Get()
  async findAll(@Query('species') species?: string) {
    return this.vaccinesService.findAll(species);
  }

  @Post()
  async create(@Body() body: any) {
    return this.vaccinesService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.vaccinesService.update(id, body);
  }
}
