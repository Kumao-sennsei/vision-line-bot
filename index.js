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

  // ✅ 画像メッセージ対応
  if (event.message.type === 'image') {
    try {
      const stream = await client.getMessageContent(event.message.id);
      const buffer = await rawBody(stream);
      const contentType = stream.headers['content-type'] || 'image/jpeg';
      const base64Image = buffer.toString('base64');
      const imageUrl = `data:${contentType};base64,${base64Image}`;

      console.log('✅画像取得成功！サイズ:', buffer.length, 'bytes');
      console.log('✅Content-Type:', contentType);

      // ✅ 会話対応くまお先生プロンプト
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    'あなたは優しくて面白い数学の先生「くまお先生」です。' +
                    '生徒が送ってきた画像の内容について、冗談を交えつつ明るく丁寧に、' +
                    '親しみやすい会話形式で返してください。難しい専門用語は使わず、' +
                    '中高生にもわかるように説明してください。',
                },
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
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // ✅ LaTeXっぽい表記をLINE向けに整形
      let replyText = response.data.choices[0].message.content || '画像の解析結果が見つかりませんでした。';
      replyText = replyText
        .replace(/\\frac{(.*?)}{(.*?)}/g, '($1)/($2)') // \frac{a}{b} → (a)/(b)
        .replace(/\\sqrt{(.*?)}/g, '√($1)')           // \sqrt{a} → √(a)
        .replace(/\\pm/g, '±')                        // \pm → ±
        .replace(/\\\[|\\\]|\\\(|\\\)/g, '')          // \[ \] \( \) → 空文字
        .replace(/\^2/g, '²')                         // ^2 → ²
        .replace(/\^3/g, '³')                         // ^3 → ³
        .replace(/\^([0-9])/g, '^$1');                // その他の ^n

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `くまお先生の回答だよ🐻✨\n\n${replyText}`,
      });

    } catch (error) {
      console.error('❌ Visionエラー:', error.response?.data || error.message);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の解析中にエラーが出たよ💥\nくまお先生、ちょっと休憩中かも？',
      });
    }
  }

  // ✅ テキストメッセージへの軽い返答（おまけ）
  if (event.message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `くまお先生です。「${event.message.text}」を受け取りました📩\n質問があれば画像も送ってね📸`,
    });
  }

  return null;
}

app.listen(port, () => {
  console.log(`くまおBot起動中🐻💡 ポート番号: ${port}`);
});
