import { Controller, Get, Post, Patch, Body, Param, Query, Req, Inject } from '@nestjs/common';
import { VisitsService } from './visits.service';

@Controller('api/visits')
export class VisitsController {
  constructor(@Inject(VisitsService) private visitsService: VisitsService) {}

  @Get()
  async findAll(@Query('petId') petId?: string) {
    return this.visitsService.findAll(petId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    const vetId = req.user?.id;
    return this.visitsService.create({ ...body, vetId });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.visitsService.update(id, body);
  }
}
