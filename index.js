// index.js
require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');

const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  PORT = 8080,
} = process.env;

if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.error('❌ LINE トークン / シークレットが設定されていません');
  process.exit(1);
}

const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};

const app = express();
const client = new Client(config);

// ───────────────────────────
// 生存確認
// ───────────────────────────
app.get('/', (_, res) => {
  res.status(200).send('✅ Kumao先生は元気です！');
});

// ───────────────────────────
// Webhookエンドポイント
// ───────────────────────────
app.post('/webhook', middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch(err => {
      console.error('❌ イベント処理エラー:', err);
      res.status(500).end();
    });
});

// ───────────────────────────
// イベント処理ロジック（テキストメッセージ専用）
// ───────────────────────────
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const userMessage = event.message.text;
  const replyMessage = {
    type: 'text',
    text: `🐻くまお先生：「${userMessage}」という質問だね、うんうん…良いところに気づいたね！`,
  };

  return client.replyMessage(event.replyToken, replyMessage);
}

// ───────────────────────────
// サーバー起動
// ───────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Kumao bot is running on port ${PORT}`);
});
