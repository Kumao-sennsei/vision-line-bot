const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// Webhookエンドポイント
app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = await Promise.all(events.map(handleEvent));
  res.json(results);
});

// Vision API 送信・返信処理
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'image') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像を送ってください📷✨',
    });
  }

  // 画像取得
  const messageId = event.message.id;
  const stream = await client.getMessageContent(messageId);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // base64エンコード
  const base64Image = buffer.toString('base64');

  // OpenAI APIへ送信（gpt-4o使用！）
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: '高校数学の先生のように、画像内の問題を解説しながら丁寧に教えてください。LaTeX記号は使ってもOKですが、式は人間が読む前提で整形してください。'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let replyText = response.data.choices[0].message.content;

    // LaTeXっぽい記号を整形して読みやすく！
    replyText = replyText
      .replace(/\\frac{(.*?)}{(.*?)}/g, '($1)/($2)')
      .replace(/\\sqrt{(.*?)}/g, '√($1)')
      .replace(/\\pm/g, '±')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\cdot/g, '・')
      .replace(/\\left|\\right/g, '')
      .replace(/\\begin{.*?}|\\end{.*?}/g, '')
      .replace(/\\[(){}[\]]/g, '')
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      .replace(/\^/g, '^');

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `🐻くまお先生の回答だよ♪\n\n${replyText}`,
    });

  } catch (error) {
    console.error('❌ Visionエラー:', error.response?.data || error.message);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'くまお先生だよ🐻 画像の処理中にエラーが発生したよ💦\nもう一度試してみてね！',
    });
  }
}

// ポート起動（Railway／Render両対応）
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`くまおBot起動中 🐻 ポート番号: ${port}`);
});
