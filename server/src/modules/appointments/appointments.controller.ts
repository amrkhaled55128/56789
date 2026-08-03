import { Controller, Get, Post, Patch, Body, Param, Query, Inject } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

@Controller('api/appointments')
export class AppointmentsController {
  constructor(@Inject(AppointmentsService) private appointmentsService: AppointmentsService) {}

  @Get()
  async findAll(@Query('date') date?: string) {
    return this.appointmentsService.findAll(date);
  }

  @Post()
  async create(@Body() body: any) {
    return this.appointmentsService.create(body);
  }

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body('status') status: any) {
    return this.appointmentsService.updateStatus(id, status);
  }
}
