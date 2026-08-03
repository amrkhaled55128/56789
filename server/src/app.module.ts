import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_FILTER, Reflector } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OwnersModule } from './modules/owners/owners.module';
import { BreedsModule } from './modules/breeds/breeds.module';
import { PetsModule } from './modules/pets/pets.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { VisitsModule } from './modules/visits/visits.module';
import { VaccinesModule } from './modules/vaccines/vaccines.module';
import { VaccinationsModule } from './modules/vaccinations/vaccinations.module';
import { LabsModule } from './modules/labs/labs.module';
import { SurgeriesModule } from './modules/surgeries/surgeries.module';
import { BoardingModule } from './modules/boarding/boarding.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OwnersModule,
    BreedsModule,
    PetsModule,
    AppointmentsModule,
    VisitsModule,
    VaccinesModule,
    VaccinationsModule,
    LabsModule,
    SurgeriesModule,
    BoardingModule,
    SuppliersModule,
    InventoryModule,
    InvoicesModule,
    PaymentsModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
  ],
  providers: [
    Reflector,
    RolesGuard,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
