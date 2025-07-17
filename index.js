console.log("✅ LINE Bot 起動成功！");

// ---------- 必要なライブラリ ----------
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const line = require('@line/bot-sdk');
const app = express(); // ← これがなかっただけ！

// ---------- LINE設定 ----------
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
app.use(bodyParser.json());

// ---------- Webhookエンドポイント ----------
app.post('/webhook', async (req, res) => {app.post('/webhook', (req, res) => {
  console.log("📩 受信イベント:", JSON.stringify(req.body, null, 2)); // ←追加！

  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result));
});

  
  try {
    const events = req.body.events;
    for (const event of events) {
      console.log(JSON.stringify(event, null, 2));
      if (event.type === 'message' && event.message.type === 'text') {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          if (userMessage.includes("こんにちは")) {
  replyMessage = "こんにちは！くまお先生だよ～✨ 今日も質問まってるからねっ(●´ω｀●)";
} else {
  replyMessage = `くまお先生です！あなたの質問『${userMessage}』を受け取りました`;
}
`
        });
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error('エラー:', err);
    res.status(500).end();
  }
});

// ---------- サーバー起動 ----------
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('くまお先生は起動中です！'));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
