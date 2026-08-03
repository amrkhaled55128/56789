import { Controller, Get, Inject } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/reports')
export class ReportsController {
  constructor(@Inject(ReportsService) private reportsService: ReportsService) {}

  @Get('dashboard')
  async getDashboardMetrics() {
    return this.reportsService.getDashboardMetrics();
  }

  @Get('financial')
  async getFinancialReport() {
    return this.reportsService.getFinancialReport();
  }
}
