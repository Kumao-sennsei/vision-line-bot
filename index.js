const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const dotenv = require('dotenv');
const rawBody = require('raw-body');

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();
const client = new Client(config);

// LINEの署名チェックのために rawBody を使う
app.use((req, res, next) => {
  rawBody(req, {
    length: req.headers['content-length'],
    limit: '1mb',
    encoding: true
  }, (err, string) => {
    if (err) return next(err);
    req.rawBody = string;
    next();
  });
});

app.post('/webhook', middleware(config), async (req, res) => {
  Promise
    .all(req.body.events.map(async (event) => {
      if (event.type === 'message' && event.message.type === 'text') {
        const userMessage = event.message.text;
        const replyMessage = {
          type: 'text',
          text: `くまお先生です！あなたの質問『${userMessage}』を受け取りました。\n（※このメッセージはテスト応答です）`
        };

        try {
          await client.replyMessage(event.replyToken, replyMessage);
        } catch (err) {
          console.error('返信エラー:', err);
        }
      }
    }))
    .then(() => res.status(200).end())
    .catch(err => {
      console.error(err);
      res.status(500).end();
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
