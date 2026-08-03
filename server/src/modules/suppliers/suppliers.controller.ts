import { Controller, Get, Post, Patch, Body, Param, Inject } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

@Controller('api/suppliers')
export class SuppliersController {
  constructor(@Inject(SuppliersService) private suppliersService: SuppliersService) {}

  @Get()
  async findAll() {
    return this.suppliersService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return this.suppliersService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.suppliersService.update(id, body);
  }
}
