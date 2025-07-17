// LINE Vision Bot（くまお先生）完全版：くまおフィルター＆数式整形つき

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

// Webhookエンドポイント
app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'image') {
      const messageId = event.message.id;
      const stream = await client.getMessageContent(messageId);
      const buffer = await getRawBody(stream);
      const base64Image = buffer.toString('base64');

      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `
あなたは「くまお先生」という、親しみやすく丁寧に教えるAI教師です。
以下のルールに従って返答してください。

- 優しい口調で、生徒と会話しながら答える
- 結論を先に伝え、理由や手順も丁寧に説明する
- 数式は読みやすく、LaTeXではなく「人間が読むような表現」に変換する
- 文章の途中で「(*'ω'*)」や「✨」「(笑)」などの柔らかい絵文字も使ってOK
- 難しい言葉はかみ砕いて説明する
- 英語ではなく、すべて日本語で返すこと！
                `.trim()
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                  },
                  {
                    type: 'text',
                    text: 'この問題の解き方と答えを教えてください。',
                  }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.7,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );

        let replyText = response.data.choices[0].message.content;

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
          .replace(/\^(\d)/g, '^$1');

        const messageText = `
🐻くまお先生の回答だよ！

${replyText}

✨また分からなかったら何度でも聞いてね(*'ω'*)
        `.trim();

        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: messageText,
        });
      } catch (error) {
        console.error('❌ Visionエラー:', error?.response?.data || error.message);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'くまお先生ちょっと休憩中かも…💤　もう一度試してみてね📷✨',
        });
      }
    } else {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'くまお先生だよ🐻 画像を送ってくれたら、読み取ってわかりやすく教えるね！',
      });
    }
  }
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`✅ くまおBot起動中 🧸 ポート番号: ${PORT}`);
});
