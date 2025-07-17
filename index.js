require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const { v2: cloudinary } = require("cloudinary");

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf } }));

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

// メイン処理
app.post("/webhook", line.middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then((result) => res.json(result));
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "image") {
    return client.replyMessage(event.replyToken, { type: "text", text: "画像を送ってください！" });
  }

  try {
    const messageId = event.message.id;
    const stream = await client.getMessageContent(messageId);

    // Bufferへ変換
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Cloudinaryへアップロード
    const uploadResult = await cloudinary.uploader.upload_stream({ resource_type: "image" }, async (error, result) => {
      if (error) throw error;

      const imageUrl = result.secure_url;
      const gptResponse = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-4-vision-preview",
        messages: [
          { role: "user", content: [{ type: "image_url", image_url: { url: imageUrl } }] }
        ],
        max_tokens: 1000
      }, {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      });

      const replyText = gptResponse.data.choices[0].message.content;
      await client.replyMessage(event.replyToken, { type: "text", text: replyText });
    });

    const passthrough = require("stream").PassThrough();
    passthrough.end(buffer);
    passthrough.pipe(uploadResult);
  } catch (err) {
    console.error("画像処理エラー:", err);
    return client.replyMessage(event.replyToken, { type: "text", text: "画像の処理中にエラーが発生しました(´・ω・｀)" });
  }
}

// ポート起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at ${PORT}`));
