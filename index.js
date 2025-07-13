const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

app.post('/webhook', line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then(result => res.json(result));
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'image') {
    return Promise.resolve(null);
  }

  const messageId = event.message.id;
  try {
    const stream = await client.getMessageContent(messageId);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const imageBuffer = Buffer.concat(chunks);

    const formData = new FormData();
    formData.append("file", imageBuffer, {
      filename: "image.jpg",
      contentType: "image/jpeg"
    });

    const uploadRes = await axios.post("https://store1.gofile.io/uploadFile", formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    const imageUrl = uploadRes.data.data.directLink;

    const gptRes = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "この画像について教えてください。" },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      max_tokens: 1000
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const aiMessage = gptRes.data.choices[0].message.content;

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiMessage
    });

  } catch (err) {
    console.error("Error:", err);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像の処理中にエラーが発生しました。'
    });
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});