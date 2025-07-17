import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};

const app    = express();
const client = new Client(config);

// ── Webhook ──────────────────────────────────────────
app.post(
  '/webhook',
  express.raw({ type: '*/*' }),        // ← LINE 署名検証用
  middleware(config),
  async (req, res) => {
    const events = req.body.events;

    await Promise.all(
      events.map(async (event) => {
        if (event.type !== 'message') return;

        if (event.message.type === 'text') {
          // テキストをそのまま返す
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `Echo: ${event.message.text}`,
          });
        } else {
          // 画像・スタンプ等は未対応
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'ごめんね！ まだテキストしかわからないんだ🙏',
          });
        }
      })
    );

    res.status(200).end();
  }
);

// ── Listen ───────────────────────────────────────────
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
