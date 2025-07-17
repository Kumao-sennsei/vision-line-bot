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
  console.log("📩 受信イベント:", JSON.stringify(req.body, null, 2));

  const events = req.body.events;

  const results = await Promise.all(events.map(async (event) => {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;

      let replyMessage;
      if (userMessage.includes("こんにちは")) {
        replyMessage = "こんにちは！くまお先生だよ〜✨ 今日も質問まってるからねっ(●´ω｀●)";
      } else {
        replyMessage = `くまお先生です！あなたの質問『${userMessage}』を受け取りました`;
      }

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage
      });
    }
  }));

  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
