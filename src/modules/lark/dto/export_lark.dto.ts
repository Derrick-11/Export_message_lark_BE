// src/lark/dto/export-lark.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ExportLarkDto {
  @ApiProperty()
  chatId: string;
  @ApiProperty()
  startTime?: string;
  @ApiProperty()
  endTime?: string;
}
