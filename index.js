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

// ── ヘルスチェック ──
app.get('/', (_, res) => res.sendStatus(200));

// ── ChatGPT（テキスト）──────────────────────
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

// ── Stream → Buffer ─────────────────────────
const toBuffer = stream =>
  new Promise((ok, ng) => {
    const chunks = [];
    stream.on('data',  c => chunks.push(c));
    stream.on('end',   () => ok(Buffer.concat(chunks)));
    stream.on('error', ng);
  });

// ── Webhook ─────────────────────────────────
app.post('/webhook', line.middleware(cfg), async (req, res) => {
  await Promise.all(req.body.events.map(handleEvent));
  res.sendStatus(200);
});

async function handleEvent(e) {
  if (e.type !== 'message') return;

  // テキスト → ChatGPT
  if (e.message.type === 'text') {
    const reply = await askGPT(e.message.text);
    return client.replyMessage(e.replyToken, { type: 'text', text: reply });
  }

  // 画像 → GPT‑4o Vision
  if (e.message.type === 'image') {
    // ① 先に即レス（タイムアウト防止）
    await client.replyMessage(e.replyToken, {
      type: 'text',
      text: '画像受け取ったよ！解析中…',
    });

    try {
      // ② 画像取得
      const stream = await client.getMessageContent(e.message.id);
      const buf    = await toBuffer(stream);
      const b64    = buf.toString('base64');

      // ③ Vision API
      const { data } = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: `data:image/jpeg;base64,${b64}` },
                { type: 'text',      text: 'この画像を日本語で簡単に説明して' }
              ]
            }
          ]
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
      );

      const caption = data.choices[0].message.content.trim();
      return client.pushMessage(e.source.userId, { type: 'text', text: caption });

    } catch (err) {
      console.error(err);
      return client.pushMessage(
        e.source.userId,
        { type: 'text', text: '画像の解析に失敗しちゃった💦' }
      );
    }
  }
}

// ── Listen ─────────────────────────────────
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Bot on ' + port));
