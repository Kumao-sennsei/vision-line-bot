require('dotenv').config();
const express = require('express');
const { Client, middleware } = require('@line/bot-sdk');
const OpenAI = require('openai').default;          // ← ここを変更
const cloudinary = require('cloudinary').v2;

// LINE SDK 設定
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);

// OpenAI SDK 設定
const openai = new OpenAI({                        // ← default クラスを new する
  apiKey: process.env.OPENAI_API_KEY
});

cloudinary.config({
  cloud_name:   process.env.CLOUDINARY_CLOUD_NAME,
  api_key:      process.env.CLOUDINARY_API_KEY,
  api_secret:   process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const PORT = process.env.PORT || 8080;

app.post('/webhook', middleware(lineConfig), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== 'message') return;

  if (event.message.type === 'text') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `You said: ${event.message.text}`,
    });
  }

  if (event.message.type === 'image') {
    const stream = await client.getMessageContent(event.message.id);
    const buffer = await streamToBuffer(stream);

    // Cloudinary にアップロード
    const upload = await new Promise((resolve, reject) => {
      const u = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (err, out) => err ? reject(err) : resolve(out)
      );
      u.end(buffer);
    });

    // GPT-4 Vision 解析
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an image analysis assistant.' },
        { role: 'user',   content: `Analyze this image: ${upload.secure_url}` }
      ]
    });

    const answer = resp.choices[0].message.content;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: answer,
    });
  }
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const buf = [];
    stream.on('data', c => buf.push(c));
    stream.on('end', () => resolve(Buffer.concat(buf)));
    stream.on('error', reject);
  });
}

app.listen(PORT, () => console.log(`Listening on ${PORT}`));
