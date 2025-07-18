// 必要モジュールの読み込み
require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const OpenAI = require('openai');
const cloudinary = require('cloudinary').v2;

// Express アプリ作成
const app = express();

// LINE SDK 設定
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new Client(lineConfig);

// OpenAI 設定（gpt-4o-mini を利用）
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cloudinary 設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// イベントごとの処理
async function handleEvent(event) {
  try {
    // テキストメッセージへの対応
    if (event.type === 'message' && event.message.type === 'text') {
      const userText = event.message.text;

      // ChatGPT に送信
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'あなたは「くまお先生」。なんでも優しく面白く、自然に会話する先生です。' },
          { role: 'user',   content: `以下のユーザーの質問を、親しみやすく要約しつつ自然な会話調で解説してください。\n\n${userText}` }
        ]
      });

      const replyText = completion.choices[0].message.content;
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText
      });
    }

    // 画像メッセージへの対応
    else if (event.type === 'message' && event.message.type === 'image') {
      const stream = await lineClient.getMessageContent(event.message.id);
      const bufs = [];
      for await (const chunk of stream) bufs.push(chunk);
      const buffer = Buffer.concat(bufs);

      // Cloudinary にアップロード
      const uploadResult = await new Promise((res, rej) => {
        cloudinary.uploader.upload_stream(
          { resource_type: 'image' },
          (err, result) => err ? rej(err) : res(result)
        ).end(buffer);
      });

      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `📸 画像のアップロードに成功しました！\n${uploadResult.secure_url}`
      });
    }

    // その他イベントは無視
  } catch (err) {
    console.error('Event handling error:', err);
  }
}

// Webhook エンドポイント
app.post('/webhook', middleware(lineConfig), (req, res) => {
  // ① すぐに 200 OK を返す
  res.sendStatus(200);

  // ② バックグラウンドでイベントを処理
  (req.body.events || []).forEach(ev => {
    handleEvent(ev);
  });
});

// ヘルスチェック用
app.get('/', (_req, res) => {
  res.send('くまお先生 BOT が稼働中です！');
});

// サーバ起動
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
