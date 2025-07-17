require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const { v2: cloudinary } = require("cloudinary");
const app = express();

// LINE設定
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

// webhook受信
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    await Promise.all(events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== "message") return;
  const msg = event.message;

  // テキストメッセージ応答
  if (msg.type === "text") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `くまお先生だよ！ご質問ありがとう♪：「${msg.text}」だね！ただいま考え中…(●´ω｀●)`,
    });
  }

  // 画像メッセージ処理
  if (msg.type === "image") {
    try {
      const stream = await client.getMessageContent(msg.id);
      const buffers = [];
      for await (const chunk of stream) {
        buffers.push(chunk);
      }
      const buffer = Buffer.concat(buffers);

      // Cloudinaryへアップロード
      const result = await cloudinary.uploader.upload_stream({ resource_type: "image" }, async (error, result) => {
        if (error) {
          console.error("Cloudinary Error:", error);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "画像アップロードに失敗しました…(´・ω・｀) もう一度送ってくれる？",
          });
          return;
        }

        // OpenAI Visionに送信
        const imageUrl = result.secure_url;
        const aiResponse = await askGPTWithImage(imageUrl);

        await client.replyMessage(event.replyToken, {
          type: "text",
          text: aiResponse,
        });
      });

      // 書き込みストリームへバッファ送信
      const writeStream = result;
      writeStream.end(buffer);

    } catch (err) {
      console.error("Image Error:", err);
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "画像の処理中にエラーが発生しました💦 形式やサイズを確認してもう一度送ってね！",
      });
    }
  }
}

// OpenAI Visionへ送信
async function askGPTWithImage(imageUrl) {
  const apiKey = process.env.OPENAI_API_KEY;
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "この画像について詳しく説明して！" },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );
  return response.data.choices[0].message.content;
}

// サーバー起動
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
