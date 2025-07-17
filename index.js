const express = require('express');
const line = require('@line/bot-sdk');
const dotenv = require('dotenv');
const axios = require('axios');
const rawBody = require('raw-body');

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();
const port = process.env.PORT || 3000;

app.post('/webhook', line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message') return null;

  if (event.message.type === 'image') {
    try {
      const stream = await client.getMessageContent(event.message.id);
      const buffer = await rawBody(stream);
      const contentType = stream.headers['content-type'] || 'image/jpeg';
      const base64Image = buffer.toString('base64');
      const imageUrl = `data:${contentType};base64,${base64Image}`;

      console.log('✅画像取得成功！サイズ:', buffer.length, 'bytes');
      console.log('✅Content-Type:', contentType);

      // ✅ Vision APIへ送信（モデル指定：gpt-4-vision-preview）
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'この画像について説明してください。' },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl },
                },
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

      const replyText = response.data.choices[0].message.content || '画像の解析結果がありませんでした。';
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `くまお先生の回答だよ🐻✨\n\n${replyText}`,
      });

    } catch (error) {
      console.error('❌ Visionエラー:', error.response?.data || error.message);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の解析中にエラーが出たよ💥\nAPIキーやモデル権限を確認してね！',
      });
    }
  }

  if (event.message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `くまお先生です。「${event.message.text}」を受け取りました📩`,
    });
  }

  return null;
}

app.listen(port, () => {
  console.log(`くまおBot起動中🐻💡 ポート番号: ${port}`);
});
