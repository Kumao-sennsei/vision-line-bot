require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const { v2: Cloudinary } = require('cloudinary');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = process.env.PORT || 8080;

// LINE SDK 設定
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);

// Cloudinary 設定
Cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// OpenAI 設定
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== 'message') return;
  const { type, text, id } = event.message;

  if (type === 'text') {
    // OpenAI に投げて「自然な対話+解説」を生成
    const reply = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'あなたは「くまお先生」という優しくて面白い先生です。何でもわかりやすく答えてください。' },
        { role: 'user', content: text }
      ],
    });
    const answer = reply.data.choices[0].message.content.trim();

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: answer,
    });
  }
  else if (type === 'image') {
    // 画像取得→Cloudinaryアップロード
    const stream = await client.getMessageContent(id);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const upload = await Cloudinary.uploader.upload_stream({ resource_type: 'image' }, () => {});
    upload.end(buffer);
    const imageUrl = upload.url;

    // OpenAI Vision（仮）へ送って解説を取得
    const vision = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'これはユーザーが送った画像の説明をしてください。' },
        { role: 'user', content: imageUrl }
      ],
    });
    const caption = vision.data.choices[0].message.content.trim();

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `くまお先生の画像解析🐻📷\n${caption}`,
    });
  }
}

app.listen(port, () => {
  console.log(`Bot on ${port}`);
});
