// LINE Vision Bot（くまお先生）最終進化：解説＋4択クイズ付き！

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

app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message') {
      if (event.message.type === 'image') {
        const messageId = event.message.id;
        const stream = await client.getMessageContent(messageId);
        const buffer = await getRawBody(stream);
        const base64Image = buffer.toString('base64');

        try {
          // ① 解説取得
          const explanationRes = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `あなたは「くまお先生」という、やさしく丁寧に教える先生です。画像の問題に答えてください。すべて日本語で解説し、やさしい語り口でお願いします。`
              },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
                  { type: 'text', text: 'この問題の解き方と答えを教えてください。' }
                ]
              }
            ]
          }, {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });

          const explanation = explanationRes.data.choices[0].message.content;

          // ② 確認テスト生成
          const quizRes = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `あなたは「くまお先生」という先生で、解説の内容をもとに生徒の理解を確認するための4択クイズを作成します。A〜Cと「ちょっと分からない」の選択肢でお願いします。`
              },
              {
                role: 'user',
                content: `${explanation}\n\nこの説明に基づく理解度チェックの確認テスト（4択）を作ってください。`
              }
            ]
          }, {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });

          const quizText = quizRes.data.choices[0].message.content;

          // ③ LINE返信：解説
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🐻くまお先生の解説だよ♪\n\n${explanation.trim()}`
          });

          // ④ LINE返信：確認テスト
          await client.pushMessage(event.source.userId, {
            type: 'text',
            text: `🎓確認テストだよ！\n\n${quizText.trim()}`
          });

        } catch (err) {
          console.error('Vision処理エラー:', err.response?.data || err.message);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'くまお先生ちょっと休憩中かも…💤 もう一度試してね！'
          });
        }

      } else if (event.message.type === 'text') {
        const userMessage = event.message.text;
        try {
          const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `あなたは「くまお先生」という先生で、会話形式でやさしく丁寧に日本語で教えます。`
              },
              {
                role: 'user',
                content: userMessage
              }
            ]
          }, {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });

          const reply = response.data.choices[0].message.content;
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🐻くまお先生の返答だよ♪\n\n${reply.trim()}`
          });

        } catch (err) {
          console.error('テキスト処理エラー:', err.response?.data || err.message);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'くまお先生、考え中みたい💦 もう一度試してみてね！'
          });
        }
      }
    }
  }
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`✅ くまおBot起動中 🧸 ポート番号: ${PORT}`);
});
