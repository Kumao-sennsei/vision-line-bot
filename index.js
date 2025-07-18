const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const FormData = require('form-data');
const { Configuration, OpenAIApi } = require('openai');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// LINE Bot設定
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// OpenAI設定
const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

// LINEからのリクエストを受け取る
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    const results = await Promise.all(events.map(handleEvent));
    res.json(results);
  } catch (err) {
    console.error('Webhook Error:', err);
    res.status(500).end();
  }
});

// イベントハンドラー
async function handleEvent(event) {
  if (event.type !== 'message') return Promise.resolve(null);

  const message = event.message;

  // ① テキストメッセージ → GPT回答
  if (message.type === 'text') {
    const response = await openai.createChatCompletion({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: 'あなたは優しい先生くまお先生です。画像や質問にやさしく、分かりやすく解説してください。' },
        { role: 'user', content: message.text },
      ],
    });

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: response.data.choices[0].message.content,
    });
  }

  // ② 画像メッセージ → Cloudinaryにアップ→Vision解析
  if (message.type === 'image') {
    // LINEの画像取得
    const stream = await client.getMessageContent(message.id);
    const buffers = [];

    for await (const chunk of stream) {
      buffers.push(chunk);
    }

    const imageBuffer = Buffer.concat(buffers);

    // Cloudinaryにアップロード
    const uploadResult = await cloudinary.uploader.upload_stream(
      { resource_type: 'image' },
      async (error, result) => {
        if (error || !result?.secure_url) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '画像のアップロードに失敗しました💦',
          });
        }

        // Visionで画像解析
        try {
          const visionRes = await openai.createChatCompletion({
            model: 'gpt-4-vision-preview',
            messages: [
              {
                role: 'system',
                content: 'あなたは画像を丁寧に解説する優しい先生です。',
              },
              {
                role: 'user',
                content: [
                  { type: 'text', text: 'この画像の内容をわかりやすく説明してください。' },
                  { type: 'image_url', image_url: { url: result.secure_url } },
                ],
              },
            ],
            max_tokens: 1000,
          });

          const replyText = visionRes.data.choices[0].message.content;

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: replyText || '画像を確認しましたが、説明が難しいようです💦',
          });
        } catch (err) {
          console.error('Vision API error:', err);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '画像の解析中にエラーが発生しました💦',
          });
        }
      }
    );

    const readableStream = require('stream').Readable.from(imageBuffer);
    readableStream.pipe(uploadResult);
    return;
  }

  // その他のメッセージ
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: 'くまお先生はそのメッセージにはまだ対応していません🐻',
  });
}

// サーバー起動
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});
