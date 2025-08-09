import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { google } from 'googleapis';
import { Response } from 'express';
import { ExportLarkDto } from './dto/export_lark.dto';

@Injectable()
export class LarkService {
  private readonly appId = process.env.APP_ID;
  private readonly appSecret = process.env.APP_SECRET;
  private readonly sheetId = process.env.SHEET_ID;

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

  private async fetchMessages(dto: ExportLarkDto, token: string) {
    const url = 'https://open.larksuite.com/open-apis/im/v1/messages';
    const headers = { Authorization: `Bearer ${token}` };
    const { chatId, startTime, endTime } = dto;

    const params: any = {
      container_id_type: 'chat',
      container_id: chatId,
      page_size: 50,
      sort_type: 'ByCreateTimeAsc',
    };

    if (startTime) {
      params.start_time = Math.floor(new Date(startTime).getTime() / 1000);
    }

    if (endTime) {
      params.end_time = Math.floor(new Date(endTime).getTime() / 1000);
    }

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

  async exportToGoogleSheet(values: any[], sheetId: string, res: Response) {
    try {
      // Load credentials
      const auth = new google.auth.GoogleAuth({
        keyFile: 'credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });

      const sheetName = `Export_${new Date().toISOString().replace(/[:.]/g, '-')}`;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      const data = [['Thời gian', 'Người gửi', 'Nội dung'], ...values];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: data,
        },
      });

      res.json({
        success: true,
        message: 'Đã ghi dữ liệu vào Google Sheet',
        sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0`,
        sheetName,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportMessages(dto: ExportLarkDto, res: Response): Promise<void> {
    const token = await this.getTenantAccessToken();
    const messages = await this.fetchMessages(dto, token);
    const parsed = await this.parseMessages(messages, token);
    await this.exportToGoogleSheet(parsed, this.sheetId, res);
  }
}
