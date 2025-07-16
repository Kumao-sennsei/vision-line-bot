import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import dotenv from 'dotenv';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const app = express();
app.use(express.json());

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = [];

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'image') {
      const messageId = event.message.id;

      try {
        const stream = await client.getMessageContent(messageId);
        const buffers = [];

        for await (const chunk of stream) {
          buffers.push(chunk);
        }

        const imageBuffer = Buffer.concat(buffers);
        const uploadRes = await cloudinary.uploader.upload_stream(
          { resource_type: 'image' },
          async (error, result) => {
            if (error) {
              await client.replyMessage(event.replyToken, {
                type: 'text',
                text: '画像のアップロードに失敗しました。',
              });
              return;
            }

            const imageUrl = result.secure_url;

            const visionRes = await axios.post(
              'https://api.openai.com/v1/chat/completions',
              {
                model: 'gpt-4-vision-preview',
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'image_url',
                        image_url: {
                          url: imageUrl,
                        },
                      },
                      {
                        type: 'text',
                        text: 'この画像について教えてください。',
                      },
                    ],
                  },
                ],
                max_tokens: 1000,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                },
              }
            );

            const replyText = visionRes.data.choices[0].message.content;

            await client.replyMessage(event.replyToken, {
              type: 'text',
              text: replyText,
            });
          }
        );

        stream.pipe(uploadRes);
      } catch (err) {
        console.error(err);
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '画像処理でエラーが発生しました。',
        });
      }
    }
  }

  res.status(200).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
