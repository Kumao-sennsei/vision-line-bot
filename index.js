const express = require('express');
const app = express();
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text;
        let replyMessage = '';

        if (userMessage.includes('こんにちは')) {
          replyMessage = "こんにちは！くまお先生だよ〜🐻✨ 今日も質問まってるからねっ(●´ω｀●)";
        } else {
          replyMessage = `くまお先生です！あなたの質問『${userMessage}』を受け取りました`;
        }

        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: replyMessage
        });
      }
    }

    res.sendStatus(200); // LINEサーバーに成功を返す
  } catch (err) {
    console.error('エラー:', err);
    res.sendStatus(500); // エラーがあれば500を返す
  }
});



