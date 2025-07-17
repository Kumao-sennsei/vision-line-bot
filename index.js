// LINE Vision Bot（くまお先生）進化系：画像対応＋クイズ正誤応答＋やさしい再説明＋式整形完全対応＋会話対応（画像安定化）

const express = require('express');
const { middleware, Client } = require('@line/bot-sdk');
const axios = require('axios');
const dotenv = require('dotenv');
const getRawBody = require('raw-body');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

let lastExplanation = '';
let lastQuizAnswer = '';
let lastQuizDetail = '';

function convertLatexToReadable(text) {
  return text
    .replace(/\frac\{(.*?)\}\{(.*?)\}/g, '$1/$2')
    .replace(/\times|\btimes\b|\stimes|\*|\*\*/g, '×')
    .replace(/\div|\bdiv\b|\//g, '÷')
    .replace(/\cdot/g, '・')
    .replace(/\sqrt\{(.*?)\}/g, '√($1)')
    .replace(/\left\(|\right\)/g, '')
    .replace(/[\[\]()]/g, '')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\\/g, '')
    .replace(/\bsqrt\b/gi, '√')
    .replace(/sprt/gi, '√')
    .replace(/\bpm\b/g, '±')
    .replace(/\bneq\b/g, '≠')
    .replace(/\bgeq\b/g, '≥')
    .replace(/\bleq\b/g, '≤')
    .replace(/\balpha\b/g, 'α')
    .replace(/\bbeta\b/g, 'β')
    .replace(/\bgamma\b/g, 'γ')
    .replace(/\btheta\b/g, 'θ')
    .replace(/\blambda\b/g, 'λ')
    .replace(/\bsigma\b/g, 'σ')
    .replace(/\bpi\b/g, 'π')
    .replace(/\binfty\b/g, '∞')
    .replace(/\bln\b/g, 'ln')
    .replace(/\blog\b/g, 'log')
    .replace(/\bexp\b/g, 'exp')
    .replace(/\bapprox\b/g, '≈')
    .replace(/\bto\b/g, '→')
    .replace(/\begin\{.*?\}|\end\{.*?\}/g, '')
    .replace(/\$/g, '')
    .replace(/\\n/g, '\n');
}

app.use('/webhook', middleware(config), express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

app.post('/webhook', async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message') {
      if (event.message.type === 'image') {
        const messageId = event.message.id;
        try {
          const stream = await client.getMessageContent(messageId);
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const buffer = Buffer.concat(chunks);

          const mimeType = buffer[0] === 0x89 ? 'image/png' : 'image/jpeg';
          const base64Image = buffer.toString('base64');
          const imageDataUrl = `data:${mimeType};base64,${base64Image}`;

          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4-vision-preview',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'この画像を日本語で解説して。数式は読みやすくしてね。' },
                    { type: 'image_url', image_url: { url: imageDataUrl } },
                  ]
                }
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

          const explanation = convertLatexToReadable(response.data.choices[0].message.content);
          lastExplanation = explanation;

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: explanation,
          });
        } catch (err) {
          console.error('画像処理エラー:', err.message);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '画像の処理中にエラーが発生しました。形式やサイズを確認してね！',
          });
        }
      } else if (event.message.type === 'text') {
        const userText = event.message.text.trim();
        const lowerText = userText.toLowerCase();

        const greetings = ['こんにちは', 'こんばんは', 'おはよう', 'やっほー', 'ありがとう'];
        if (greetings.includes(userText)) {
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'やっほー！くまお先生だよ🐻✨ なんでも質問してね！',
          });
          continue;
        }

        if (['a', 'b', 'c', 'd'].includes(lowerText)) {
          let reply;
          if (lowerText === lastQuizAnswer.toLowerCase()) {
            reply = `正解だよ！✨すごいね！\n\n${lastExplanation}`;
          } else {
            reply = `ちょっとちがったみたい💦\n\nもう一度くまお先生がやさしく解説するね：\n\n${lastQuizDetail}`;
          }
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: reply,
          });
        } else {
          try {
            const qaRes = await axios.post(
              'https://api.openai.com/v1/chat/completions',
              {
                model: 'gpt-4',
                messages: [
                  { role: 'system', content: 'あなたはやさしい家庭教師「くまお先生」です。会話形式で質問に答えてください。' },
                  { role: 'user', content: userText }
                ],
                max_tokens: 1000,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                }
              }
            );

            const explanation = convertLatexToReadable(qaRes.data.choices[0].message.content);
            lastExplanation = explanation;

            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: explanation,
            });
          } catch (err) {
            console.error('会話応答エラー:', err.message);
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'くまお先生、ちょっと疲れてるみたい💦 また質問してね！'
            });
          }
        }
      }
    }
  }
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`くまお先生起動中 🐻 ポート番号: ${PORT}`);
});
