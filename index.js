// index.js  ←今これをそのまま貼り替えれば、テキスト返信だけ確実に動きます。
// 画像処理などは一切入れていません。まずは “くまお先生” のテキスト返信に専念。

import 'dotenv/config';
import express from 'express';
import { Client, middleware } from '@line/bot-sdk';

// ─── 環境変数 ──────────────────────────────
const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PORT = 8080,
} = process.env;

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.error('❌ LINE の環境変数が設定されていません');
  process.exit(1);
}

const lineConfig = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const lineClient = new Client(lineConfig);

// ─── Express ───────────────────────────────
const app = express();
app.get('/', (_, res) => res.send('Kumao bot is alive!'));

// Webhook
app.post('/webhook', middleware(lineConfig), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// ─── イベント処理 ─────────────────────────
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userMsg = event.message.text;
  const reply = `🐻くまお先生：『${userMsg}』…うんうん、いい質問だね！`;

  return lineClient.replyMessage(event.replyToken, {
    type: 'text',
    text: reply,
  });
}

// ─── サーバ起動 ───────────────────────────
app.listen(PORT, () => console.log(`Kumao bot on ${PORT}`));
