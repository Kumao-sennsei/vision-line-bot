require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

app.post('/webhook', middleware(config), async (req, res) => {
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
    // テキストは優しく面白く返す
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `くまお先生だよ🐻\n「${text}」っていう質問だね！\nゆっくり解説するよ～😊`,
    });
  }
  else if (type === 'image') {
    // 画像は OpenAI Vision API などで解析 → 要約＆解説
    const stream = await client.getMessageContent(id);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // ここで Cloudinary へアップする or OpenAI へ渡す例
    const uploadRes = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        file: `data:image/jpeg;base64,${buffer.toString('base64')}`,
        upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
      }
    );

    // URL を OpenAI Vision に渡し、自然言語説明を取得
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/images/analyze', // 仮のエンドポイント
      { url: uploadRes.data.secure_url },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );

    const description = openaiRes.data.description || 'ごめんね、解説に失敗しちゃった…';

    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `くまお先生の画像解析結果🐻📷\n${description}`,
    });
  }
}

app.listen(port, () => {
  console.log(`Bot on ${port}`);
});
