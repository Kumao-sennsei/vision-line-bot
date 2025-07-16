import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import dotenv from 'dotenv';
import getRawBody from 'raw-body';

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new Client(config);
const app = express();

// ✅ Webhook署名チェックに必要な生ボディ処理（LINE専用）
app.use('/webhook', express.raw({ type: '*/*' }));

// ✅ Webhook受信（Visionもここで対応）
app.post('/webhook', async (req, res, next) => {
  try {
    // LINE SDKの署名検証用にrawBodyを付ける
    req.rawBody = await getRawBody(req);
    next();
  } catch (err) {
    console.error('❌ rawBodyエラー:', err);
    res.status(500).end();
  }
}, middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    console.log('✅ 受信イベント:', events);

    // 各イベントに対応する処理（ここを自由に拡張してOK！）
    const results = await Promise.all(
      events.map(async (event) => {
        if (event.type === 'message' && event.message.type === 'text') {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: `くまお先生：『${event.message.text}』について考えてみようか(｀・ω・´)`,
          });
        }

        // ✨ 画像メッセージ対応（Vision API処理をここに追加）
        if (event.type === 'message' && event.message.type === 'image') {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'くまお先生：画像を受け取ったよ！いま解析中だよ…(●´ω｀●)',
          });
        }

        return Promise.resolve(null);
      })
    );

    res.status(200).json(results);
  } catch (err) {
    console.error('❌ イベント処理中のエラー:', err);
    res.status(500).end();
  }
});

// ✅ サーバー起動（Render用ポート指定）
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
