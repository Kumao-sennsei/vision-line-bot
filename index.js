// index.js
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');

const app = express();

// LINE Bot設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// 応答処理
const client = new line.Client(config);

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(result => res.json(result))
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

// メッセージイベント処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // テキスト以外は無視（画像など）
    return Promise.resolve(null);
  }

  // シンプルな応答（くまお先生風）
  const replyText = `くまお先生です。\n「${event.message.text}」を受け取りましたよ😊`;

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`起動しました on port ${PORT}`);
});
