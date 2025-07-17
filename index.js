import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import axios from 'axios';
import dotenv from 'dotenv';
import getRawBody from 'raw-body';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

// 画像読み取り用
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
                  content: 'あなたはやさしくて親しみやすい数学の先生「くまお先生」です。生徒が画像を送ってきたら、画像内の数式を読み取り、やさしく会話しながら丁寧に説明してください。数式の意味や解き方、注意点なども会話風に含めてください。答えだけではなく、考え方や理由も話すことが大切です。',
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

          // LaTeX風 → 読みやすく変換
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
            text: 'くまお先生ちょっと休憩中かも…💤　もう一度送ってみてね！',
          });
        }
      } else {
        // テキスト等その他メッセージに対して
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `🧸くまお先生だよ！画像で質問してくれたら、読み取ってお答えするね📷✨`,
        });
      }
    }
  }
  res.status(200).end();
});

app.listen(PORT, () => {
  console.log(`✅ くまおBot起動中 🧸🎓 ポート番号: ${PORT}`);
});
