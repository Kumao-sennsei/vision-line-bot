// index.js
require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const OpenAI = require('openai');
const cloudinary = require('cloudinary').v2;

const app = express();

// LINE SDK
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);

// OpenAI SDK v4
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 画像アップロード
function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image' },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

app.post('/webhook', middleware(lineConfig), (req, res) => {
  // 即レス 200
  res.sendStatus(200);

  (req.body.events || []).forEach(async (ev) => {
    try {
      // テキスト
      if (ev.type === 'message' && ev.message.type === 'text') {
        const userText = ev.message.text;
        const aiRes = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'あなたは「くまお先生」です。優しく面白く自然に会話してください。' },
            { role: 'user', content: userText }
          ],
          temperature: 0.8,
        });
        const reply = aiRes.choices[0].message.content.trim();
        await client.replyMessage(ev.replyToken, { type: 'text', text: reply });
      }
      // 画像
      else if (ev.type === 'message' && ev.message.type === 'image') {
        const stream = await client.getMessageContent(ev.message.id);
        const bufs = [];
        for await (const c of stream) bufs.push(c);
        const buffer = Buffer.concat(bufs);

        const up = await uploadImage(buffer);
        const imageUrl = up.secure_url;

        const visRes = await openai.chat.completions.create({
          model: 'gpt-4o-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: imageUrl } },
                { type: 'text',      text: 'この画像について、小学生にもわかるようにやさしく説明してください。' }
              ]
            }
          ],
          temperature: 0.7,
        });

        const explanation = visRes.choices[0].message.content.trim();
        await client.replyMessage(ev.replyToken, {
          type: 'text',
          text: `🐻 くまお先生の画像解説だよ！\n${explanation}`,
        });
      }
    } catch (err) {
      console.error('処理エラー:', err);
      await client.replyMessage(ev.replyToken, {
        type: 'text',
        text: 'ごめんね、くまお先生ちょっと動けないみたい…また送ってね！',
      });
    }
  });
});

// ヘルスチェック
app.get('/', (_req, res) => res.send('OK'));

- const PORT = 8080;
+ const PORT = process.env.PORT || 8080;

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
