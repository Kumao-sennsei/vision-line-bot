const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();
const PORT = process.env.PORT || 3000;

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result));
});

const client = new line.Client(config);

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const replyText = `くまお先生だよ！「${event.message.text}」って言ったね、かわいいね(●´ω｀●)`;
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

app.listen(PORT, () => {
  console.log(`くまお先生サーバーが起動しました🚀 ポート: ${PORT}`);
});
