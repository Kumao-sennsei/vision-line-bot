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

// Webhook
app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message') {
      if (event.message.type === 'image') {
        const messageId = event.message.id;
        const stream = await client.getMessageContent(messageId);
        const buffer = await getRawBody(stream);

        const base64Image = buffer.toString('base64');
        const imageData = `data:image/jpeg;base64,${base64Image}`;

        try {
          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: 'あなたはやさしくて親しみやすい数学の先生「くまお先生」です。画像を送ってきた生徒に、やさしく会話しながら丁寧に数式の意味と解き方を説明してください。解答だけでなく考え方や注意点も大切に教えてあげてください。',
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'image_url',
                      image_url: { url: imageData },
                    },
                    {
                      type: 'text',
                      text: 'この問題の解き方と答えを教えてください。',
                    },
                  ],
                },
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

          // LaTeX変換を読みやすく整形
          replyText = replyText
            .replace(/\\frac{(.*?)}{(.*?)}/g, '($1)/($2)')
            .replace(/\\sqrt{(.*?)}/g, '√($1)')
            .replace(/\\pm/g, '±')
            .replace(/\\[(){}[\]]/g, '')
            .replace(/\^2/g, '²')
            .replace(/\^3/g, '³')
            .replace(/\^/g, '^');

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: `🧸くまお先生の回答だよ！\n\n${replyText}`,
          });
        } catch (error) {
          console.error('❌ Visionエラー:', error?.response?.data || error.message);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'くまお先生ちょっと休憩中かも…💤　もう一回だけ試してみてね📷✨',
          });
        }
      } else {
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `🧸くまお先生だよ！画像で質問してくれたら、読み取ってわかりやすく解説するよ📸✨`,
        });
      }
    }
  }
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`✅ くまおBot起動中 🧸 ポート番号: ${PORT}`);
});
