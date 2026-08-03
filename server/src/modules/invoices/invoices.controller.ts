import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

@Controller('api/invoices')
export class InvoicesController {
  constructor(@Inject(InvoicesService) private invoicesService: InvoicesService) {}

  @Get()
  async findAll() {
    return this.invoicesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.invoicesService.create(body);
  }
}
