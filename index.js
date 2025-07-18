require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const { Configuration, OpenAIApi } = require('openai');
const cloudinary = require('cloudinary').v2;

// LINE SDK 設定
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);

// OpenAI 設定
const openaiConfig = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
const openai = new OpenAIApi(openaiConfig);

// Cloudinary 設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const PORT = process.env.PORT || 8080;

// Webhook エンドポイント
app.post('/webhook', middleware(lineConfig), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== 'message') return;

  // テキストはそのままエコー
  if (event.message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `You said: ${event.message.text}`,
    });
  }

  // 画像メッセージの場合
  if (event.message.type === 'image') {
    // LINE からバイナリを取得
    const stream = await client.getMessageContent(event.message.id);
    const buffer = await streamToBuffer(stream);

    // Cloudinary にアップロード
    const result = await new Promise((resolve, reject) => {
      const up = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (err, out) => (err ? reject(err) : resolve(out))
      );
      up.end(buffer);
    });

    // OpenAI（GPT-4o-mini）へ画像 URL を投げる
    const imageUrl = result.secure_url;
    const completion = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an image analysis assistant.' },
        { role: 'user', content: `Analyze this image: ${imageUrl}` },
      ],
    });
    const replyText = completion.data.choices[0].message.content;

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyText,
    });
  }
}

// Stream → Buffer 変換ヘルパー
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
