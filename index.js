require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');

const app = express();
const port = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(config);

app.post('/webhook', middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(async (e) => {
      if (e.type === 'message' && e.message.type === 'text') {
        await client.replyMessage(e.replyToken, {
          type: 'text',
          text: `Echo: ${e.message.text}`,
        });
      }
    }));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

app.listen(port, () => console.log(`Listening on ${port}`));
