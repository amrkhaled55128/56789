import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@UseGuards(RolesGuard)
@Controller('api/audit')
export class AuditController {
  constructor(@Inject(AuditService) private auditService: AuditService) {}

  @Roles('ADMIN')
  @Get()
  async findAll() {
    return this.auditService.findAll();
  }
}
