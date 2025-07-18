// Load .env
require('dotenv').config();

const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const OpenAI = require('openai');
const cloudinary = require('cloudinary').v2;

const app = express();

// LINE SDK 設定
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new Client(lineConfig);

// OpenAI v4 設定
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cloudinary 設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function handleEvent(ev) {
  try {
    if (ev.type === 'message' && ev.message.type === 'text') {
      const userText = ev.message.text;
      const ai = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'あなたは優しくて面白い「くまお先生」です。' },
          { role: 'user',   content: `次の文章を自然に要約＆解説してください:\n\n${userText}` },
        ],
      });
      const reply = ai.choices[0].message.content;
      await lineClient.replyMessage(ev.replyToken, { type:'text', text: reply });
    }
    else if (ev.type === 'message' && ev.message.type === 'image') {
      // 画像 → Cloudinary
      const stream = await lineClient.getMessageContent(ev.message.id);
      const bufs = [];
      for await (const chunk of stream) bufs.push(chunk);
      const buffer = Buffer.concat(bufs);
      const up = await new Promise((res, rej) => {
        cloudinary.uploader.upload_stream({ resource_type:'image' }, (e,r)=> e?rej(e):res(r)).end(buffer);
      });
      await lineClient.replyMessage(ev.replyToken, {
        type:'text',
        text:`画像アップ成功！\n${up.secure_url}`
      });
    }
    // それ以外は無視
  } catch (e) {
    console.error('Event error:', e);
  }
}

app.post('/webhook', middleware(lineConfig), (req, res) => {
  // ① まず即レスポンス
  res.sendStatus(200);

  // ② バックグラウンドでイベントを処理
  (req.body.events || []).forEach(ev => {
    handleEvent(ev);
  });
});

// 簡易ヘルスチェック
app.get('/', (_req, res) => res.send('OK'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
