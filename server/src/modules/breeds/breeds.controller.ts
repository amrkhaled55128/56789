import { Controller, Get, Post, Body, Query, Inject } from '@nestjs/common';
import { BreedsService } from './breeds.service';

@Controller('api/breeds')
export class BreedsController {
  constructor(@Inject(BreedsService) private breedsService: BreedsService) {}

  @Get()
  async findAll(@Query('species') species?: string) {
    return this.breedsService.findAll(species);
  }

  @Post()
  async create(@Body() body: any) {
    return this.breedsService.create(body);
  }
}
