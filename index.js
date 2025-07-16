import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import bodyParser from 'body-parser';

const app = express();

// LINE SDK config
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

// ✅ ここが重要！ LINE webhook は body-parser ではなく middleware() を先に！
app.post('/webhook', middleware(config), express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }), async (req, res) => {
  try {
    const events = req.body.events;
    // イベント処理ロジック
    console.log(events);
    res.status(200).end();
  } catch (err) {
    console.error('処理中にエラー:', err);
    res.status(500).end();
  }
});

app.get('/', (req, res) => {
  res.send('Kuma先生サーバーは稼働中です！');
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
