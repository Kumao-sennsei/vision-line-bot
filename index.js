const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const dotenv = require('dotenv');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs');
const path = require('path');

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = await Promise.all(events.map(handleEvent));
  res.json(results);
});

async function handleEvent(event) {
  if (event.type !== 'message') return null;

  const message = event.message;

  // ✅ 画像メッセージ
  if (message.type === 'image') {
    try {
      const stream = await client.getMessageContent(message.id);
      const tempPath = path.join(__dirname, 'temp.jpg');
      const writer = fs.createWriteStream(tempPath);
      stream.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Cloudinaryにアップロード
      const uploadResult = await cloudinary.uploader.upload(tempPath, {
        folder: 'kumao_images',
      });

      fs.unlinkSync(tempPath); // 一時ファイル削除

      // OpenAI Vision API呼び出し
      const visionResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'この画像を見て質問に答えてください。' },
                { type: 'image_url', image_url: { url: uploadResult.secure_url } },
              ],
            },
          ],
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const replyText = visionResponse.data.choices[0].message.content;
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText,
      });
    } catch (err) {
      console.error('[画像処理エラー]', err);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の処理中にエラーが発生しました。形式やサイズを確認してください。',
      });
    }
  }

  // ✅ テキストメッセージ
  if (message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `くまお先生だよ🐻\n「${message.text}」ですね！画像も送ってくれたらもっと詳しく見れるよ！`,
    });
  }

  return null;
}

// ✅ サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`くまお先生サーバー起動中🌏 ポート: ${port}`);
});
