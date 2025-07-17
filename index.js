// index.js     ←このまま貼り替えれば OK
import 'dotenv/config';
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import OpenAI from 'openai';
import cloudinary from 'cloudinary';

// ──── env ──────────────────────────────────────────────
const {
  LINE_CHANNEL_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,
  OPENAI_API_KEY,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

// ──── LINE & OpenAI クライアント ────────────────────────
const lineConfig = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET,
};
const lineClient = new Client(lineConfig);

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

cloudinary.v2.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// ──── Express ──────────────────────────────────────────
const app = express();
app.get('/', (_, res) => res.send('Kumao bot is running!'));

// Webhook
app.post('/webhook', middleware(lineConfig), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// ──── イベント処理 ──────────────────────────────────────
async function handleEvent(event) {
  if (event.type !== 'message') return;

  if (event.message.type === 'text') {
    // やさしくおもしろく Echo
    const reply = `🐻くまお先生：『${event.message.text}』…なるほど、いい質問だね！`;
    return lineClient.replyMessage(event.replyToken, { type: 'text', text: reply });
  }

  if (event.message.type === 'image') {
    try {
      // 画像データ取得
      const stream = await lineClient.getMessageContent(event.message.id);
      const uploadRes = await new Promise((resolve, reject) => {
        const upload = cloudinary.v2.uploader.upload_stream(
          { resource_type: 'image' },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.pipe(upload);
      });

      // OpenAI Vision に投げる
      const aiRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'この画像を小学生にもわかるように説明して！' },
              { type: 'image_url', image_url: { url: uploadRes.secure_url } },
            ],
          },
        ],
      });

      const description = aiRes.choices[0].message.content.trim();
      return lineClient.replyMessage(event.replyToken, { type: 'text', text: description });
    } catch (err) {
      console.error(err);
      return lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: 'ごめんね、画像の説明に失敗しちゃった…🐻💦',
      });
    }
  }
}

// ──── サーバ起動 ────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log('Bot on', PORT));
