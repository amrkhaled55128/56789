import { Controller, Get, Post, Patch, Body, Param, Query, Inject } from '@nestjs/common';
import { BoardingService } from './boarding.service';

@Controller('api/boarding')
export class BoardingController {
  constructor(@Inject(BoardingService) private boardingService: BoardingService) {}

  @Get()
  async findAll(@Query('petId') petId?: string) {
    return this.boardingService.findAll(petId);
  }

  @Post()
  async create(@Body() body: any) {
    return this.boardingService.create(body);
  }

  @Patch(':id/checkout')
  async checkout(@Param('id') id: string) {
    return this.boardingService.checkout(id);
  }
}
