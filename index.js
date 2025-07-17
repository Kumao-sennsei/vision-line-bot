require('dotenv').config();
const express = require('express');
const line    = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};

const app    = express();
const client = new line.Client(config);

// ── webhook ─────────────────────────────
app.post('/webhook', line.middleware(config), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.status(200).end();
});

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `Echo: ${event.message.text}`,
  });
}

// ── listen ──────────────────────────────
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
