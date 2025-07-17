// LINE Vision Bot（くまお先生）完全修正版：画像対応＋会話返信＋クイズ＋LaTeX整形＋やさしい再解説＋安定動作！

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
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1/$2')
    .replace(/\\times|\btimes\b|\stimes|\*|\*\*/g, '×')
    .replace(/\\div|\bdiv\b|\//g, '÷')
    .replace(/\\cdot/g, '・')
    .replace(/\\sqrt\{(.*?)\}/g, '√($1)')
    .replace(/\\left\(|\\right\)/g, '')
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
    .replace(/\\begin\{.*?\}|\\end\{.*?\}/g, '')
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
          const contentType = stream.contentType || 'image/jpeg';
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const buffer = Buffer.concat(chunks);
          const base64Image = buffer.toString('base64');

          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4-vision-preview',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'この画像を日本語で解説して。数式は読みやすくしてね。' },
                    { type: 'image_url', image_url: { url: `data:${contentType};base64,${base64Image}` } },
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
        const userText = event.message.text.trim().toLowerCase();

        if (['a', 'b', 'c', 'd'].includes(userText)) {
          let reply;
          if (userText === lastQuizAnswer.toLowerCase()) {
            reply = '正解だよ！さすがくまお先生の生徒✨';
          } else if (userText === 'd') {
            reply = `そっか、ちょっとむずかしかったね！もう一度、くまお先生がやさしく説明するよ：\n\n${lastExplanation}`;
          } else {
            reply = `うーん、ちょっとちがったみたい💦 もう一度、くまお先生がやさしく解説するね：\n\n${lastExplanation}`;
          }

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: reply,
          });
        } else {
          const prompt = `以下の内容に関する4択クイズ（A〜D）を1問作ってください。日本語でやさしく。最後に正解を教えてください。\n\n${userText}`;
          try {
            const quizRes = await axios.post(
              'https://api.openai.com/v1/chat/completions',
              {
                model: 'gpt-4',
                messages: [
                  { role: 'user', content: prompt }
                ],
                max_tokens: 800,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                }
              }
            );

            const content = quizRes.data.choices[0].message.content;
            const parts = content.split(/正解[:：]\s?/);
            const quiz = parts[0].trim();
            lastQuizAnswer = (parts[1] || '').trim().charAt(0).toLowerCase();
            lastExplanation = content;

            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `くまお先生の確認テストだよ✨\n\n${quiz}\n\nA, B, C, D（ちょっと分からない…）から選んでね！`,
              quickReply: {
                items: [
                  { type: 'action', action: { type: 'message', label: 'A', text: 'A' } },
                  { type: 'action', action: { type: 'message', label: 'B', text: 'B' } },
                  { type: 'action', action: { type: 'message', label: 'C', text: 'C' } },
                  { type: 'action', action: { type: 'message', label: 'ちょっと分からない…', text: 'D' } },
                ]
              }
            });
          } catch (err) {
            console.error('クイズ生成エラー:', err.message);
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'くまお先生の確認テストを作れなかったみたい💦 もう一度ためしてね！'
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
