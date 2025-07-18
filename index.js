// index.js
const express = require('express');
const line = require('@line/bot-sdk');
const app = express();

// Railway対応：環境変数PORTまたは8080
const PORT = process.env.PORT || 8080;

// LINE SDK設定
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const client = new line.Client(config);

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
    // 1) 処理中通知
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像の処理中です…少々お待ちください。',
    });

    // 2) 画像取得
    const stream = await client.getMessageContent(event.message.id);
    const chunks = [];
    for await (let chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // 3) 画像解析（実装に合わせて置き換え）
    const result = await someImageProcessingFunction(buffer);

    // 4) 解析結果を pushMessage で返信
    return client.pushMessage(event.source.userId, {
      type: 'text',
      text: `解析結果: ${result.text || JSON.stringify(result)}`,
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

// 画像解析のダミー関数（実際の処理に置き換えてください）
async function someImageProcessingFunction(buffer) {
  // Cloudinary OCR／OpenAI Visionなど
  return { text: 'ダミー解析結果' };
}

// サーバ起動
app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
