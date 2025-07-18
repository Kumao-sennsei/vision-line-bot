const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const axios = require('axios');
require('dotenv').config();

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const openaiApiKey = process.env.OPENAI_API_KEY;
const client = new Client(config);

app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;

  const results = await Promise.all(events.map(async (event) => {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return Promise.resolve(null);
    }

    const userMessage = event.message.text;

    // くまお先生の会話スタイル
    const systemPrompt = `
あなたは「くまお先生」という、やさしくておもしろい数学の先生です。
相手の質問に対して、以下のように答えてください：
- まず「～という質問だね！」とやさしく確認
- それから、自然な会話でわかりやすく解説
- 最後は生徒を励ますような一言を！

語尾はやわらかく、親しみやすい口調でお願いします。
`;

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.8,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        }
      });

      const replyText = response.data.choices[0].message.content.trim();

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText,
      });

    } catch (err) {
      console.error('OpenAIエラー:', err.response?.data || err.message);

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'ごめんね、くまお先生ちょっと調子が悪いみたい…後でまた聞いてくれるかな？💦',
      });
    }
  }));

  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ くまお先生サーバーがポート${PORT}で起動中だよ！`);
});
