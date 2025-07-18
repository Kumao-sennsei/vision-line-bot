// ==========================
// 📦 vision-line-bot index.js
// Turbo + Cloudinary + Vision API対応
// ==========================

import express from 'express';
import line from '@line/bot-sdk';
import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';
import { v2 as cloudinary } from 'cloudinary';
import { OpenAI } from 'openai';

dotenv.config();

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);
const app = express();

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// OpenAI設定
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type !== 'message') continue;

    // ① 画像メッセージ処理
    if (event.message.type === 'image') {
      try {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '画像の処理中です・・・'
        });

        const stream = await client.getMessageContent(event.message.id);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        const uploadRes = await cloudinary.uploader.upload_stream({ resource_type: 'image' }, async (error, result) => {
          if (error) throw error;

          const imageUrl = result.secure_url;

          // ② Vision APIで画像解析
          const visionRes = await openai.chat.completions.create({
            model: 'gpt-4-vision-preview',
            messages: [
              {
                role: 'system',
                content: 'あなたは優しくて面白い数学の先生「くまお先生」です。画像の質問に丁寧に答えてください。'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl }
                  },
                  {
                    type: 'text',
                    text: 'この画像の内容を分かりやすく説明してください'
                  }
                ]
              }
            ],
            max_tokens: 1000
          });

          const reply = visionRes.choices[0].message.content || 'うーん、ちょっと分からないかも…';
          await client.pushMessage(event.source.userId, { type: 'text', text: reply });
        });

        const passthrough = uploadRes;
      } catch (e) {
        console.error(e);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '画像処理中にエラーが発生しました。もう一度お試しください。'
        });
      }
    }

    // ② テキストメッセージ処理
    else if (event.message.type === 'text') {
      try {
        const text = event.message.text;
        const response = await openai.chat.completions.create({
          model: 'gpt-4-turbo',
          messages: [
            { role: 'system', content: 'あなたは優しくて面白い先生「くまお先生」です。質問に分かりやすく答えてください。' },
            { role: 'user', content: text }
          ],
          max_tokens: 1000
        });

        const reply = response.choices[0].message.content;
        await client.replyMessage(event.replyToken, { type: 'text', text: reply });
      } catch (err) {
        console.error(err);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'エラーが発生しました。少し時間をおいて再度お試しください。'
        });
      }
    }
  }
  res.status(200).send('OK');
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
