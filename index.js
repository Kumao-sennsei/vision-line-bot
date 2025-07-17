require('dotenv').config();
const axios   = require('axios');
const express = require('express');
const line    = require('@line/bot-sdk');

const cfg = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};

const app    = express();
const client = new line.Client(cfg);

// ── ChatGPT (テキスト) ─────────────────────────
async function askGPT(prompt) {
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model:    'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
  );
  return data.choices[0].message.content.trim();
}

// ── バイナリ → Buffer 変換 ─────────────────────
const streamToBuffer = s =>
  new Promise((res, rej) => {
    const chunks = [];
    s.on('data',  c => chunks.push(c));
    s.on('end',   () => res(Buffer.concat(chunks)));
    s.on('error', rej);
  });

// ── Webhook ────────────────────────────────────
app.post('/webhook', line.middleware(cfg), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(event) {
  if (event.type !== 'message') return;

  // テキスト → ChatGPT
  if (event.message.type === 'text') {
    const reply = await askGPT(event.message.text);
    return client.replyMessage(event.replyToken, { type: 'text', text: reply });
  }

  // 画像 → GPT‑4o Vision
  if (event.message.type === 'image') {
    const stream = await client.getMessageContent(event.message.id);
    const buff   = await streamToBuffer(stream);
    const b64    = buff.toString('base64');

    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: `data:image/jpeg;base64,${b64}` },
              { type: 'text',      text: 'この画像を日本語で簡潔に説明して' }
            ]
          }
        ]
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );

    const caption = data.choices[0].message.content.trim();
    return client.replyMessage(event.replyToken, { type: 'text', text: caption });
  }
}

// ── listen ────────────────────────────────────
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Bot on ${port}`));
