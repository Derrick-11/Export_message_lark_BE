import { Module } from '@nestjs/common';
import { LarkModule } from './modules/lark/lark.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LarkModule,
  ],
})
export class AppModule {}
