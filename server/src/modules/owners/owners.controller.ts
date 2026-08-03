import { Controller, Get, Post, Patch, Body, Param, Query, Inject } from '@nestjs/common';
import { OwnersService } from './owners.service';

@Controller('api/owners')
export class OwnersController {
  constructor(@Inject(OwnersService) private ownersService: OwnersService) {}

  @Get()
  async findAll(@Query('query') query?: string) {
    return this.ownersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.ownersService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.ownersService.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.ownersService.update(id, body);
  }
}
