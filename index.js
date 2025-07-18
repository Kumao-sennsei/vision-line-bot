// Load .env in development
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

// OpenAI SDK v4 設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cloudinary 設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// バッファを受け取ってアップロード → URL を返す
function uploadImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'image' },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

// Webhook エンドポイント
app.post('/webhook', middleware(lineConfig), async (req, res) => {
  try {
    // すべてのイベントに非同期対応で返信
    await Promise.all(req.body.events.map(async (ev) => {
      // テキストメッセージを要約＆解説
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
        return lineClient.replyMessage(ev.replyToken, {
          type: 'text',
          text: reply,
        });
      }

      // 画像メッセージ → Cloudinary にアップ → URL 返却
      if (ev.type === 'message' && ev.message.type === 'image') {
        const stream = await lineClient.getMessageContent(ev.message.id);
        const bufs = [];
        for await (const chunk of stream) bufs.push(chunk);
        const buffer = Buffer.concat(bufs);
        const upRes = await uploadImage(buffer);
        return lineClient.replyMessage(ev.replyToken, {
          type: 'text',
          text: `画像アップ成功しました！\n${upRes.secure_url}`,
        });
      }

      // その他のイベントは無視
      return Promise.resolve();
    }));

    // LINE プラットフォーム向けに 200 応答
    res.status(200).end();
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

// サーバ起動
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
