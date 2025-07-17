// LINE Vision Bot（くまお先生）LaTeX変換＆Web検索＆クイズ評価＆再解説対応！

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
    .replace(/\times|times/g, '×')
    .replace(/\div/g, '÷')
    .replace(/\cdot/g, '・')
    .replace(/\sqrt\{(.*?)\}/g, '√($1)')
    .replace(/\left\(|\right\)/g, '')
    .replace(/[\[\]()]/g, '')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
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
                content: `あなたは「くまお先生」です。やさしい日本語で解説をしてください。`
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
            text: `🐻くまお先生の解説だよ♪\n\n${explanation}\n\n「確認テストお願い」って送ってくれたら、確認テストを出すよ♪`
          });

        } catch (err) {
          console.error('Visionエラー:', err);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'くまお先生ちょっと休憩中かも…💤'
          });
        }
      } else if (event.message.type === 'text') {
        const userMessage = event.message.text.trim();

        if (userMessage.includes('確認テスト')) {
          if (!lastExplanation) {
            await client.replyMessage(event.replyToken, { type: 'text', text: 'まずは画像を送ってね！📸' });
            return;
          }
          try {
            const quizRes = await axios.post('https://api.openai.com/v1/chat/completions', {
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: '以下の説明に基づいた理解確認の4択クイズを出し、正解の選択肢（A〜C）も明示してください。LaTeXは使わず普通の日本語で。' },
                { role: 'user', content: `${lastExplanation}\n\nクイズ作って、正解も出力して` }
              ]
            }, {
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              }
            });

            const quizFullText = quizRes.data.choices[0].message.content;
            const answerMatch = quizFullText.match(/正解[：:]\s*([ABCabc])/);
            lastQuizAnswer = answerMatch ? answerMatch[1].toUpperCase() : '';

            const quizText = convertLatexToReadable(
              quizFullText.replace(/正解[：:].*/g, '').trim()
            );

            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `🎓確認テストだよ！\n\n${quizText}`
            });

          } catch (err) {
            console.error('クイズ生成エラー:', err);
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'くまお先生、確認テストでちょっと考え中かも💦'
            });
          }
        } else if (lastQuizAnswer && /^[ABCabc]$/.test(userMessage)) {
          const userAnswer = userMessage.toUpperCase();
          const isCorrect = userAnswer === lastQuizAnswer;

          if (isCorrect) {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '🌟正解だよ！すごいね♪ 次の問題もがんばろう！'
            });
          } else {
            const reExplain = await axios.post('https://api.openai.com/v1/chat/completions', {
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'あなたはくまお先生です。生徒が不正解だったときに、さらにやさしく、丁寧にもう一度同じ内容を解説してください。' },
                { role: 'user', content: lastExplanation }
              ]
            }, {
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              }
            });

            const reExplainText = convertLatexToReadable(reExplain.data.choices[0].message.content);

            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: `😢残念、不正解だったよ。正解は ${lastQuizAnswer} だよ…\n\n🐻もう一度、くまお先生がやさしく説明するね：\n\n${reExplainText}`
            });
          }
          lastQuizAnswer = '';

        } else if (/ちょっと.*(わからない|わかんない)/.test(userMessage)) {
          const reExplain = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: 'あなたはくまお先生です。生徒が分からないと言ったら、さらにやさしく、具体的な例を交えてもう一度丁寧に説明してください。' },
              { role: 'user', content: lastExplanation }
            ]
          }, {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });

          const reExplainText = convertLatexToReadable(reExplain.data.choices[0].message.content);

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🐻大丈夫！くまお先生がもう一度、ゆっくり説明するね：\n\n${reExplainText}`
          });
        } else if (userMessage.startsWith('検索 ')) {
          const query = userMessage.replace(/^検索\s+/, '');
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🔍ごめんね！くまお先生のWeb検索機能は現在準備中なんだ💦\n将来的には「検索 ${query}」でネット検索できるようになるよ♪`
          });
        } else {
          try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
              model: 'gpt-4o',
              messages: [
                { role: 'system', content: 'あなたは「くまお先生」という先生で、やさしく日本語で説明します。' },
                { role: 'user', content: userMessage }
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
              text: `🐻くまお先生の返答だよ♪\n\n${reply}`
            });
          } catch (err) {
            console.error('会話エラー:', err);
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: 'くまお先生、考え中みたい💦 もう一回送ってみてね！'
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
