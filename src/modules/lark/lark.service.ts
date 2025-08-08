import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class LarkService {
  private readonly appId = process.env.APP_ID;
  private readonly appSecret = process.env.APP_SECRET;

  private async getTenantAccessToken(): Promise<string> {
    const url =
      'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal';
    const resp = await axios.post(url, {
      app_id: this.appId,
      app_secret: this.appSecret,
    });

    if (resp.data.code === 0) {
      return resp.data.tenant_access_token;
    }
    throw new Error(`Lấy token thất bại: ${JSON.stringify(resp.data)}`);
  }

  private async getUserNameByOpenId(openId: string, token: string) {
    if (!openId) return 'System';
    const url = `https://open.larksuite.com/open-apis/contact/v3/users/${openId}`;
    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params: { user_id_type: 'open_id' },
    });
    return resp.data?.data?.user?.name || openId;
  }

  async getChatList() {
    const token = await this.getTenantAccessToken();
    const url = 'https://open.larksuite.com/open-apis/im/v1/chats';
    const headers = { Authorization: `Bearer ${token}` };
    const params: any = { page_size: 50 };
    let chats = [];

    while (true) {
      const resp = await axios.get(url, { headers, params });
      chats = chats.concat(resp.data?.data?.items || []);
      if (!resp.data?.data?.has_more) break;
      params.page_token = resp.data?.data?.page_token;
    }
    return chats;
  }

  private async fetchMessages(chatId: string, token: string) {
    const url = 'https://open.larksuite.com/open-apis/im/v1/messages';
    const headers = { Authorization: `Bearer ${token}` };
    const params: any = {
      container_id_type: 'chat',
      container_id: chatId,
      page_size: 50,
    };
    let messages = [];

    while (true) {
      const resp = await axios.get(url, { headers, params });
      messages = messages.concat(resp.data?.data?.items || []);
      if (!resp.data?.data?.has_more) break;
      params.page_token = resp.data?.data?.page_token;
    }
    return messages;
  }

  private async parseMessages(messages: any[], token: string) {
    const parsed = [];
    for (const msg of messages.reverse()) {
      const senderId = msg.sender?.id;
      const senderName = await this.getUserNameByOpenId(senderId, token);
      const content = JSON.parse(msg.body?.content || '{}')?.text || '';
      const timestamp = Number(msg.create_time || 0) / 1000;
      const timeStr = new Date(timestamp * 1000)
        .toISOString()
        .replace('T', ' ')
        .split('.')[0];
      parsed.push([timeStr, senderName, content]);
    }
    return parsed;
  }

  private async exportToExcel(values: any[], res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Messages');

    worksheet.addRow(['Thời gian', 'Người gửi', 'Nội dung']);
    values.forEach((row) => worksheet.addRow(row));

    // Xuất file ra buffer
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    // Trả file về client mà không lưu trên server
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="messages_${Date.now()}.xlsx"`,
    );
    res.send(buffer);
  }

  async exportMessages(chatId: string, res: Response): Promise<void> {
    const token = await this.getTenantAccessToken();
    const messages = await this.fetchMessages(chatId, token);
    const parsed = await this.parseMessages(messages, token);
    await this.exportToExcel(parsed, res);
  }
}
