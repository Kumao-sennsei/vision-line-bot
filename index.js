// 1) 環境変数読み込み
require('dotenv').config();

const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');

const app = express();

// 2) LINE SDK の設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(config);

// 3) Webhook エンドポイント
app.post('/webhook', middleware(config), async (req, res) => {
  console.log('▶▶▶ /webhook called', new Date().toISOString());
  console.log('  Request body:', JSON.stringify(req.body));

  try {
    const promises = req.body.events.map(async (event) => {
      console.log('  └─ event:', event.type, event.message?.type, 'replyToken:', event.replyToken);

      // テキストメッセージだけ Echo
      if (event.type === 'message' && event.message.type === 'text') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `Echo: ${event.message.text}`,
        });
      }
    });

    await Promise.all(promises);
    res.status(200).end();
  } catch (err) {
    console.error('❌ error in /webhook handler:', err);
    res.status(500).end();
  }
});

// 4) サーバ起動
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`🚀 Listening on port ${port}`);
});
