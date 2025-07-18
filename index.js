// index.js
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
const client = new Client(lineConfig);

// OpenAI SDK v4 設定
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cloudinary 設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 画像アップロード → URL を返すユーティリティ
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
  res.sendStatus(200);  // すぐに応答

  req.body.events.forEach(async (ev) => {
    try {
      if (ev.type === 'message' && ev.message.type === 'image') {
        // 画像バイナリ取得
        const stream = await client.getMessageContent(ev.message.id);
        const bufs = [];
        for await (const chunk of stream) bufs.push(chunk);
        const buffer = Buffer.concat(bufs);

        // Cloudinary にアップロード
        const up = await uploadImage(buffer);
        const imageUrl = up.secure_url;

        // OpenAI に画像説明をリクエスト
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'あなたは「くまお先生」という、優しくて面白い先生です。' },
            { role: 'user', content: `この画像について、小学生にもわかるようにやさしく解説してください:\n${imageUrl}` }
          ],
          temperature: 0.7,
        });
        const explanation = completion.choices[0].message.content.trim();

        // 解説を返信
        await client.replyMessage(ev.replyToken, {
          type: 'text',
          text: `🐻 くまお先生の画像解説だよ！\n${explanation}`,
        });
      }
      // テキストや他のメッセージはそのまま無視 or Echo など
    } catch (e) {
      console.error(e);
      await client.replyMessage(ev.replyToken, {
        type: 'text',
        text: 'ごめんね、画像の説明に失敗しちゃった…💦',
      });
    }
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
