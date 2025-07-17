// LINE Vision Bot（くまお先生）LaTeX変換＆Web検索モード付き！

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

function convertLatexToReadable(text) {
  return text
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1/$2')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\\sqrt\{(.*?)\}/g, '√($1)')
    .replace(/\\cdot/g, '・')
    .replace(/\\left\(|\\right\)/g, '')
    .replace(/\\\[/g, '')
    .replace(/\\\]/g, '')
    .replace(/\\\(/g, '')
    .replace(/\\\)/g, '')
    .replace(/\\/g, '')
    .replace(/\btimes\b/g, '×')
    .replace(/\bdiv\b/g, '÷');
}

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
          const explanationRes = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `あなたは「くまお先生」という、やさしく丁寧に教える先生です。画像の問題に答えてください。すべて日本語で解説し、やさしい語り口でお願いします。LaTeXなどの難しい表現は使わず、誰にでも分かりやすく書いてください。`
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

          const explanationRaw = explanationRes.data.choices[0].message.content;
          const explanation = convertLatexToReadable(explanationRaw);
          lastExplanation = explanation;

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🐻くまお先生の解説だよ♪\n\n${explanation.trim()}\n\n「確認テストお願い」って送ってくれたら、確認テストを出すよ♪`
          });

        } catch (err) {
          console.error('Vision処理エラー:', err.response?.data || err.message);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'くまお先生ちょっと休憩中かも…💤 もう一度試してね！'
          });
        }

      } else if (event.message.type === 'text') {
        const userMessage = event.message.text.trim();

        if (userMessage.includes('確認テスト')) {
          if (!lastExplanation) {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'まだ解説していないから、まずは問題を送ってね📸'
            });
            return;
          }

          try {
            const quizRes = await axios.post('https://api.openai.com/v1/chat/completions', {
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: `あなたは「くまお先生」という先生で、解説の内容をもとに生徒の理解を確認するための4択クイズを作成します。A〜Cと「ちょっと分からない」の選択肢でお願いします。LaTeXや\(\)などは使わず、普通の日本語表現でお願いします。`
                },
                {
                  role: 'user',
                  content: `${lastExplanation}\n\nこの説明に基づく理解度チェックの確認テスト（4択）を作ってください。`
                }
              ]
            }, {
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              }
            });

            const quizRaw = quizRes.data.choices[0].message.content;
            const quizText = convertLatexToReadable(quizRaw);

            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `🎓確認テストだよ！\n\n${quizText.trim()}`
            });

          } catch (err) {
            console.error('クイズ生成エラー:', err.response?.data || err.message);
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'くまお先生、確認テストの準備がまだできてないみたい💦'
            });
          }
        } else if (userMessage.startsWith('検索 ')) {
          const query = userMessage.replace(/^検索\s+/, '');
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🔍ごめんね！くまお先生のWeb検索機能は現在準備中なんだ💦
将来的には「検索 ${query}」って送るだけで、ネットで調べた内容も返せるようにする予定だよ♪`
          });
        } else {
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

            const replyRaw = response.data.choices[0].message.content;
            const reply = convertLatexToReadable(replyRaw);

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
  }
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`✅ くまおBot起動中 🧸 ポート番号: ${PORT}`);
});
