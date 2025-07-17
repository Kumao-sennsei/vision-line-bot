require('dotenv').config();
const axios = require('axios');
const express = require('express');
const line    = require('@line/bot-sdk');

const cfg = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};

const app    = express();
const client = new line.Client(cfg);

// ── OpenAI ChatGPT 呼び出し ──────────────────
async function askGPT(prompt) {
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model:  'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
  );
  return res.data.choices[0].message.content.trim();
}

// ── webhook ───────────────────────────────────
app.post('/webhook', line.middleware(cfg), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.status(200).end();
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  // ChatGPT へ転送して回答を取得
  const reply = await askGPT(event.message.text);

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: reply,
  });
}

// ── listen ────────────────────────────────────
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Bot on ${port}`));
