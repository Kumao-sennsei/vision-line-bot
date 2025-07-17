// index.js  —  くまお先生バージョン 🐻

const express = require('express');
const line      = require('@line/bot-sdk');
const { Configuration, OpenAIApi } = require('openai');

// ── 環境変数 ─────────────────────────────────
require('dotenv').config();                 // .env があれば読み込む
const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  OPENAI_API_KEY,
} = process.env;

// ── LINE SDK 設定 ────────────────────────────
const config = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

// ── Express ───────────────────────────────────
const app = express();
app.use(express.json());

// ── くまお先生のテキスト返信 ───────────────────
const kumaoReply = (text) =>
  `🐻 くまお先生だよ！\n「${text}」って言ったんだね。\nうんうん、なるほど〜！今日もいっしょにがんばろうね♪`;

// ── Webhook ───────────────────────────────────
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// ── メインハンドラ ───────────────────────────
async function handleEvent(event) {
  if (event.type !== 'message') return;

  // ── テキスト ───────────────────────────────
  if (event.message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: kumaoReply(event.message.text.trim()),
    });
  }

  // ── 画像 ───────────────────────────────────
  if (event.message.type === 'image') {
    try {
      // 1) LINE から画像を取得
      const stream = await client.getMessageContent(event.message.id);
      const chunks = [];
      stream.on('data', (c) => chunks.push(c));
      await new Promise((rs, rj) => {
        stream.on('end', rs);
        stream.on('error', rj);
      });
      const buffer = Buffer.concat(chunks);

      // 2) OpenAI Vision に投げる
      const openai = new OpenAIApi(new Configuration({ apiKey: OPENAI_API_KEY }));
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: `data:image/jpeg;base64,${buffer.toString('base64')}` },
              { type: 'text',      text: 'この画像を日本語で簡単に説明してください。' },
            ],
          },
        ],
      });

      const aiText = completion.choices[0].message.content.trim();
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `🐻 くまお先生の画像説明だよ！\n${aiText}`,
      });
    } catch (err) {
      console.error(err);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🐻 くまお先生だよ！画像の解析に失敗しちゃった、ごめんね💦',
      });
    }
  }
}

// ── 起動 ─────────────────────────────────────
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Bot on ${port}`));

module.exports = app;
