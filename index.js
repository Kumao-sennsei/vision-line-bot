import 'dotenv/config';
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import { v2 as cloudinary } from 'cloudinary';
import OpenAI from 'openai';

// LINE設定
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);

// Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// OpenAI設定
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Express準備
const app = express();
app.use(express.json());

// Webhookエンドポイント
app.post('/webhook', middleware(lineConfig), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).send('OK');
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

// メインイベント処理
async function handleEvent(event) {
  // テキストメッセージ
  if (event.type === 'message' && event.message.type === 'text') {
    // OpenAI GPTで日本語解説
    try {
      const gptRes = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'あなたは優しくて面白い数学の先生「くまお先生」です。必ず日本語で、ユーモアを交えて、分かりやすく会話してください。',
          },
          {
            role: 'user',
            content: event.message.text,
          },
        ],
        max_tokens: 1000,
      });

      const replyText = gptRes.choices[0].message.content?.trim() || 'ごめん、うまく説明できなかったみたい…';
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText,
      });
    } catch (e) {
      console.error(e);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'くまお先生もびっくり！エラーが出ちゃいました…',
      });
    }
    return;
  }

  // 画像メッセージ
  if (event.type === 'message' && event.message.type === 'image') {
    try {
      // 画像バッファ取得
      const stream = await client.getMessageContent(event.message.id);
      const buffer = await streamToBuffer(stream);

      // Cloudinaryにアップロード
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: 'image' },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        uploadStream.end(buffer);
      });

      // OpenAI Visionに日本語指示で画像解析
      const visionRes = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'あなたは優しくて面白い数学の先生「くまお先生」です。必ず日本語で、ユーモアも入れて、画像の内容や問題を分かりやすく解説してください。',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: uploadResult.secure_url } },
              { type: 'text', text: 'この画像の内容を日本語で詳しく、かつ面白く解説してください。' },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const replyText = visionRes.choices[0].message.content?.trim() || '画像の解析に失敗しました…';
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyText,
      });
    } catch (e) {
      console.error(e);
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: '画像の解析中にエラーが発生したよ。ごめんね！',
      });
    }
    return;
  }
}

// ストリーム→バッファ変換
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
