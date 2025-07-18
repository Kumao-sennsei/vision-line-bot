const express = require('express');
const line = require('@line/bot-sdk');
const app = express();

// 環境変数からポートを取得（Railway互換）
const PORT = process.env.PORT || 8080;

// LINE SDK用のクライアント設定
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const client = new line.Client(config);

// ミドルウェア設定
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

// イベントハンドラー（例: テキスト返信だけ）
function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `受け取ったメッセージ: ${event.message.text}`,
  });
}

// サーバ起動
app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
