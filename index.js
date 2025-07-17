// LINE Vision Bot（くまお先生）LaTeX変換＆Web検索＆クイズ評価＆再解説＆画像対応！

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
    .replace(/\bsqrt\b/g, '√')
    .replace(/\bsprt\b/gi, '√')
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
    .replace(/\bbegin\{.*?\}|\bend\{.*?\}/g, '')
    .replace(/\$/g, '')
    .replace(/\\n/g, '\n');
}

app.post('/webhook', middleware(config), express.json({ verify: (req, res, buf) => { req.rawBody = buf } }), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'image') {
      const messageId = event.message.id;
      const stream = await client.getMessageContent(messageId);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      const base64Image = buffer.toString('base64');

      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4-vision-preview',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'この画像の内容を日本語で解説して。数式はわかりやすく整えてください。' },
                  { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
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

        const explanation = convertLatexToReadable(response.data.choices[0].message.content);
        lastExplanation = explanation;

        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: explanation,
        });
      } catch (err) {
        console.error('Vision APIエラー:', err.message);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '画像の処理中にエラーが発生しました。画像形式やサイズを確認してください。',
        });
      }
    }
  }
  res.status(200).end();
});
