import { Module } from '@nestjs/common';
import { SurgeriesService } from './surgeries.service';
import { SurgeriesController } from './surgeries.controller';

@Module({
  controllers: [SurgeriesController],
  providers: [SurgeriesService],
  exports: [SurgeriesService],
})
export class SurgeriesModule {}
