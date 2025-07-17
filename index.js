// index.js（ルートに置くだけ / まるっと置換で OK）
import 'dotenv/config';
import express from 'express';
import line from '@line/bot-sdk';
import axios from 'axios';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret:      process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app    = express();

// 署名検証付き Webhook エンドポイント
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

// イベントごとのハンドラ
async function handleEvent(event) {
  if (event.type !== 'message') return;

  const { message } = event;

  // --- ① テキスト ----------------------------
  if (message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type : 'text',
      text : `Echo: ${message.text}`,
    });
  }

  // --- ② 画像 -------------------------------
  if (message.type === 'image') {
    try {
      // 元画像バイナリを取得
      const stream  = await client.getMessageContent(message.id);
      const chunks  = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer  = Buffer.concat(chunks);

      // ★ここで外部 API に buffer を送る、または簡易判定だけ返す例
      // 今回はサイズを返すだけのダミー
      const info = `画像を受信しました！サイズ: ${buffer.length} byte`;

      return client.replyMessage(event.replyToken, { type: 'text', text: info });
    } catch (err) {
      console.error('Image handle error:', err);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の解析に失敗しました🙏',
      });
    }
  }

  // 他メッセージタイプ
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: 'テキストか画像を送ってね！',
  });
}

// --------------------------------------------
const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Bot on ${port}`));
