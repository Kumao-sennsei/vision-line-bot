import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Readable } from 'stream';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new Client(config);
const app = express();

// LINE専用Webhookハンドラ
app.post('/webhook', middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (error) {
    console.error('webhook error:', error);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  // メッセージ以外は無視
  if (event.type !== 'message' || event.message.type !== 'image') {
    return;
  }

  // 画像取得
  const imageBuffer = await downloadImage(event.message.id);

  // Vision APIへ送信
  const base64Image = imageBuffer.toString('base64');
  const visionResponse = await fetchFromOpenAI(base64Image);

  // くまお先生の返答送信
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `くまお先生の回答：\n${visionResponse}`,
  });
}

async function downloadImage(messageId) {
  const stream = await client.getMessageContent(messageId);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fetchFromOpenAI(base64Image) {
  const apiKey = process.env.OPENAI_API_KEY;
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: 'この画像から分かることを教えてください。',
            },
          ],
        },
      ],
      max_tokens: 1000,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.choices[0].message.content.trim();
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
