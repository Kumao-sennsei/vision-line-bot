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

/* ─────────── ① ヘルスチェック用 ─────────── */
app.get('/', (_, res) => res.status(200).send('OK'));

/* ─────────── ② ChatGPT（テキスト） ───────── */
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

/* ─────────── ③ 画像 → Buffer ─────────── */
const toBuffer = s =>
  new Promise((ok, ng) => {
    const c = [];
    s.on('data', d => c.push(d));
    s.on('end',  () => ok(Buffer.concat(c)));
    s.on('error', ng);
  });

/* ─────────── ④ Webhook ──────────────── */
app.post('/webhook', line.middleware(cfg), async (req, res) => {
  await Promise.all(req.body.events.map(handle));
  res.sendStatus(200);
});

async function handle(e) {
  if (e.type !== 'message') return;

  /* — テキスト — */
  if (e.message.type === 'text') {
    const reply = await askGPT(e.message.text);
    return client.replyMessage(e.replyToken, { type: 'text', text: reply });
  }

  /* — 画像 — */
  if (e.message.type === 'image') {
    await client.replyMessage(e.replyToken, {
      type: 'text', text: '画像受け取ったよ！解析中…',
    });

    try {
      const s   = await client.getMessageContent(e.message.id);
      const b64 = (await toBuffer(s)).toString('base64');

      const { data } = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-vision-preview',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: `data:image/jpeg;base64,${b64}` },
              { type: 'text',      text: 'この画像を日本語で簡単に説明して' }
            ]
          }]
        },
        { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
      );

      return client.pushMessage(
        e.source.userId,
        { type: 'text', text: data.choices[0].message.content.trim() }
      );

    } catch (err) {
      console.error('[OpenAI]', err.response?.status, err.response?.data);
      return client.pushMessage(
        e.source.userId,
        { type: 'text', text: '画像の解析に失敗しちゃった💦' }
      );
    }
  }
}

/* ─────────── ⑤ Listen ──────────────── */
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Bot on ' + port));
