// index.js（完全貼るだけコード）
// くまお先生：優しくておもしろく、なんでも答えてくれるAI先生

require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const rawBody = require('raw-body');
const { Configuration, OpenAIApi } = require('openai');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 8080;

// LINE設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

// OpenAI設定
const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 生の画像データ受け取り用
app.post('/webhook', line.middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = await Promise.all(events.map(handleEvent));
  res.json(results);
});

async function handleEvent(event) {
  if (event.type !== 'message') return;

  if (event.message.type === 'text') {
    // テキストメッセージを要約＋優しく解説
    const question = event.message.text;

    const gptResponse = await openai.createChatCompletion({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'あなたはくまお先生という、なんでも答えてくれる優しくて面白い先生です。質問に対して自然に要約し、わかりやすく丁寧に優しく解説してください。できれば会話風で！',
        },
        {
          role: 'user',
          content: question,
        },
      ],
    });

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: gptResponse.data.choices[0].message.content.trim(),
    });
  }

  if (event.message.type === 'image') {
    try {
      const stream = await client.getMessageContent(event.message.id);
      const buffer = await rawBody(stream);

      // Cloudinaryにアップロード
      const uploadRes = await cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        async (error, result) => {
          if (error) {
            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: '画像のアップロードに失敗しちゃったよ…( ;∀;)',
            });
            return;
          }

          // OpenAI Visionで画像＋説明文を解析
          const visionRes = await openai.createChatCompletion({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content:
                  'あなたはくまお先生という、画像に関する質問にやさしく丁寧におもしろく答える先生です。画像を見て、どんなことかを会話風に説明してください。',
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: result.secure_url,
                    },
                  },
                ],
              },
            ],
          });

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: visionRes.data.choices[0].message.content.trim(),
          });
        }
      );

      // bufferをCloudinaryに流す
      require('streamifier').createReadStream(buffer).pipe(uploadRes);
    } catch (err) {
      console.error('画像処理エラー:', err);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の解析に失敗しちゃったよ…ごめんね( ;∀;)',
      });
    }
  }
}

app.listen(port, () => {
  console.log(`Bot on ${port}`);
});
