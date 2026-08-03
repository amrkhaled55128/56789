import { Controller, Get, Post, Patch, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@UseGuards(RolesGuard)
@Controller('api/users')
export class UsersController {
  constructor(@Inject(UsersService) private usersService: UsersService) {}

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Roles('ADMIN')
  @Post()
  async create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }
}
