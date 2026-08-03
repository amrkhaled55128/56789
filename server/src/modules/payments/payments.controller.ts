import { Controller, Get, Post, Body, Inject } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('api/payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private paymentsService: PaymentsService) {}

  @Get()
  async findAll() {
    return this.paymentsService.findAll();
  }

  @Post()
  async create(@Body() body: any) {
    return this.paymentsService.create(body);
  }
}
