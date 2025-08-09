// src/lark/lark.controller.ts
import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LarkService } from './lark.service';
import { ExportLarkDto } from './dto/export_lark.dto';
import { Response } from 'express';

@ApiTags('Lark Export')
@Controller('lark')
export class LarkController {
  constructor(private readonly larkService: LarkService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhóm chat' })
  async getChatList() {
    return this.larkService.getChatList();
  }

  @Post()
  @ApiOperation({ summary: 'Export tin nhắn Lark ra file Excel' })
  async exportMessages(@Body() dto: ExportLarkDto, @Res() res: Response) {
    return await this.larkService.exportMessages(dto, res);
  }
}
