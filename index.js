// index.js
const express = require('express');
const line = require('@line/bot-sdk');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const app = express();

// Railway対応：環境変数PORTまたは8080
const PORT = process.env.PORT || 8080;

// LINE SDK設定
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const client = new line.Client(config);

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// JSONパース
app.use(express.json());

// Webhookエンドポイント
app.post('/webhook', (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// イベントハンドラー（テキスト＆画像対応）
async function handleEvent(event) {
  console.log('📷 handleEvent got:', event.type, event.message?.type);

  // —— 画像イベント ——
  if (event.type === 'message' && event.message.type === 'image') {
    // 1) 処理中を通知
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像の処理中です…少々お待ちください。',
    });

    // 2) 画像取得
    const stream = await client.getMessageContent(event.message.id);
    const chunks = [];
    for await (let chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // 3) Cloudinary にアップ
    const uploadResult = await new Promise((resolve, reject) => {
      const uploader = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (err, result) => err ? reject(err) : resolve(result)
      );
      uploader.end(buffer);
    });
    const imageUrl = uploadResult.secure_url;

    // 4) OpenAI Chat API に画像 URL で問い合わせ
    const chatRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'この画像を説明してください。' },
          { role: 'user', content: imageUrl }
        ]
      },
      { headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );
    const description = chatRes.data.choices[0].message.content.trim();

    // 5) 解析結果を pushMessage で返信
    return client.pushMessage(event.source.userId, {
      type: 'text',
      text: `解析結果: ${description}`,
    });
  }

  // —— テキストイベント ——
  if (event.type === 'message' && event.message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `受け取ったメッセージ: ${event.message.text}`,
    });
  }

  // その他は無視
  return Promise.resolve(null);
}

// サーバ起動
app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
