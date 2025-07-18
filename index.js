/// ✅ 完全動作構成 for Railway + LINE Messaging API + Cloudinary + OpenAI Vision
/// ✅ index.js

require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;

const app = express();
app.use(express.json());

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// 画像からbase64
async function imageBufferToBase64(buffer) {
  const stream = Readable.from(buffer);
  const upload = await cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
    if (error) throw error;
    return result;
  });
  stream.pipe(upload);
}

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(async (event) => {
      if (event.type !== 'message') return;

      if (event.message.type === 'image') {
        const messageId = event.message.id;
        const stream = await client.getMessageContent(messageId);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        // Cloudinaryへアップロード
        const result = await new Promise((resolve, reject) => {
          const upload = cloudinary.uploader.upload_stream({ resource_type: 'image' }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
          Readable.from(buffer).pipe(upload);
        });

        const imageUrl = result.secure_url;

        // OpenAI Visionへ送信
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4-vision-preview',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'この画像についてやさしく説明して！' },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }
            ],
            max_tokens: 1000
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const replyText = response.data.choices[0].message.content;
        await client.replyMessage(event.replyToken, { type: 'text', text: replyText });

      } else if (event.message.type === 'text') {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '画像を送ってくれたらやさしく解説するよ～！📷✨'
        });
      }
    }));
    res.status(200).end();
  } catch (error) {
    console.error('❌ エラー:', error);
    res.status(500).end();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('🚀 Server running on port', port);
});
