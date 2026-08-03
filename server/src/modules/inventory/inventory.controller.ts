import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('api/inventory')
export class InventoryController {
  constructor(@Inject(InventoryService) private inventoryService: InventoryService) {}

  @Get()
  async findAll() {
    return this.inventoryService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.inventoryService.create(body);
  }

  @Post('movement')
  async createMovement(@Body() body: any) {
    return this.inventoryService.createMovement(body);
  }
}
