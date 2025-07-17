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

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o', // ← 最新＆Vision対応モデル
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'LaTeXなどは使わず、画像に写っている内容をやさしく丁寧に日本語で説明してください。分数や平方根などは記号でお願いします。' },
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

      // ✅ LaTeX記法っぽい数式を整形！
      let replyText = response.data.choices[0].message.content || '解析結果が見つかりませんでした。';
      replyText = replyText
        .replace(/\\frac{(.*?)}{(.*?)}/g, '($1)/($2)') // \frac → (a)/(b)
        .replace(/\\sqrt{(.*?)}/g, '√($1)')           // \sqrt → √
        .replace(/\\pm/g, '±')                        // \pm → ±
        .replace(/\\\[|\\\]|\\\(|\\\)/g, '')          // \[ \] \( \) → 空文字
        .replace(/\^2/g, '²')                         // ^2 → ²
        .replace(/\^3/g, '³')                         // ^3 → ³
        .replace(/\^([0-9])/g, '^$1');                // その他の ^n はそのまま

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `くまお先生の回答だよ🐻✨\n\n${replyText}`,
      });

    } catch (error) {
      console.error('❌ Visionエラー:', error.response?.data || error.message);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の解析中にエラーが発生しました💥\nくまお先生、少し休憩中かも？',
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
