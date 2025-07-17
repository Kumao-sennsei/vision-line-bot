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

  // ✅ 画像メッセージ処理
  if (event.message.type === 'image') {
    try {
      const stream = await client.getMessageContent(event.message.id);
      const buffer = await rawBody(stream);
      const base64Image = buffer.toString('base64');

      const visionResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'この画像を見て答えてください：' },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }
      );

      const replyText = visionResponse.data.choices[0].message.content || '解析できませんでした💦';
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `くまお先生の回答だよ🐻✨\n\n${replyText}`,
      });

    } catch (error) {
      console.error('Vision連携エラー:', error);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の処理中にエラーが発生しました💥\nくまお先生、ちょっと休憩中かも？',
      });
    }
  }

  // ✅ テキストメッセージ処理
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
