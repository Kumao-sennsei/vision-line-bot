// index.js
require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const { Configuration, OpenAIApi } = require('openai');
const cloudinary = require('cloudinary').v2;

const app = express();

// ── 1) 環境変数 ───────────────────
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── 2) LINE クライアント ─────────────
const lineClient = new Client(lineConfig);

// ── 3) Webhook エンドポイント ────────
app.post('/webhook', middleware(lineConfig), async (req, res) => {
  console.log('▶ /webhook', JSON.stringify(req.body));

  try {
    const tasks = req.body.events.map(async (ev) => {
      // テキストメッセージ
      if (ev.type === 'message' && ev.message.type === 'text') {
        const userText = ev.message.text;

        // OpenAI に送って要約＆解説
        const aiRes = await openai.createChatCompletion({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'あなたは優しくて面白い「くまお先生」です。' },
            { role: 'user', content: `次の文章を自然な会話調で要約＆解説してください:\n\n${userText}` },
          ],
        });
        const replyText = aiRes.data.choices[0].message.content;

        return lineClient.replyMessage(ev.replyToken, {
          type: 'text',
          text: replyText,
        });
      }

      // 画像メッセージ
      if (ev.type === 'message' && ev.message.type === 'image') {
        // まずは LINE からバイナリ取得
        const stream = await lineClient.getMessageContent(ev.message.id);
        const buffers = [];
        for await (const chunk of stream) buffers.push(chunk);
        const imageBuffer = Buffer.concat(buffers);

        // Cloudinary にアップ
        const uploadRes = await cloudinary.uploader.upload_stream({ resource_type: 'image' }, (err, out) => {
          if (err) throw err;
          return out;
        }).end(imageBuffer);

        // URL を返すだけ（解析は後日）
        return lineClient.replyMessage(ev.replyToken, {
          type: 'text',
          text: `画像を受け取りました！こちらから見られますよ → ${uploadRes.secure_url}`,
        });
      }

      // それ以外は何もしない
    });

    await Promise.all(tasks);
    res.status(200).end();

  } catch (err) {
    console.error('❌ Error in handler:', err);
    res.status(500).end();
  }
});

// ── 4) サーバ起動 ───────────────────
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`🚀 Listening on ${port}`));
