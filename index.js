// ✅くまお先生 LINE Bot：index.js（貼るだけ完成版）
require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
}));

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    const results = await Promise.all(events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error('Webhookエラー:', err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;

  const prompt = `生徒からの質問：「${userMessage}」\nこの質問に、くまお先生としてやさしく、ユーモアも交えて、要約＋解説してください。`; // くまお先生の口調に指示

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });

    const replyText = completion.data.choices[0].message.content;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: replyText,
    });
  } catch (err) {
    console.error('OpenAI応答エラー:', err);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'くまお先生ちょっと混乱中…またすぐ復活するね！',
    });
  }
}

app.listen(port, () => {
  console.log(`くまお先生サーバー起動中！ポート: ${port}`);
});
