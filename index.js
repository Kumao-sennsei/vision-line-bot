import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import line from '@line/bot-sdk';
import { config as cloudinaryConfig, uploader } from 'cloudinary';
import getRawBody from 'raw-body';

dotenv.config();

cloudinaryConfig({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
app.use('/webhook', line.middleware({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
}));

const client = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

app.post('/webhook', async (req, res) => {
  try {
    const body = await getRawBody(req, { length: req.headers['content-length'], limit: '10mb' });
    req.body = JSON.parse(body.toString());
  } catch (err) {
    return res.status(400).send('Invalid body');
  }

  const events = req.body.events;
  const results = await Promise.all(events.map(handleEvent));
  res.json(results);
});

async function handleEvent(event) {
  if (event.type !== 'message') return null;

  if (event.message.type === 'image') {
    try {
      const stream = await client.getMessageContent(event.message.id);
      const uploadResult = await uploader.upload_stream({ resource_type: 'image' }, async (error, result) => {
        if (error) throw error;

        const imageUrl = result.secure_url;
        const visionRes = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4-vision-preview',
            messages: [
              {
                role: 'system',
                content: 'あなたは優しい数学の先生「くまお先生」です。画像にある問題を読み取り、分かりやすく日本語で解説してください。'
              },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }
            ],
            max_tokens: 1000
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const replyText = visionRes.data.choices[0].message.content;
        await client.replyMessage(event.replyToken, { type: 'text', text: replyText });
      });

      stream.pipe(uploadResult);
      return;
    } catch (err) {
      console.error(err);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の処理中にエラーが発生しました。'
      });
    }
  }

  if (event.message.type === 'text') {
    const reply = `くまお先生です。「${event.message.text}」について考えますね！`;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: reply
    });
  }

  return null;
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server is running on port ${port}`));
