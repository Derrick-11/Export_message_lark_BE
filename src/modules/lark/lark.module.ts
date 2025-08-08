import { Module } from '@nestjs/common';
import { LarkController } from './lark.controller';
import { LarkService } from './lark.service';

@Module({
  imports: [],
  controllers: [LarkController],
  providers: [LarkService],
})
export class LarkModule {}
