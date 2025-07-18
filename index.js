// index.js（くまお先生がやさしく自然に会話）
require("dotenv").config();
const express = require("express");
const { Client, middleware } = require("@line/bot-sdk");
const axios = require("axios");

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;
  const results = await Promise.all(
    events.map(async (event) => {
      if (event.type === "message" && event.message.type === "text") {
        return handleTextMessage(event);
      } else {
        return Promise.resolve(null);
      }
    })
  );
  res.status(200).json(results);
});

async function handleTextMessage(event) {
  const userMessage = event.message.text;

  // OpenAIへ送信するメッセージ構成（くまお先生フィルター）
  const messages = [
    {
      role: "system",
      content:
        "あなたはくまお先生という優しくて面白い先生です。質問されたことを自然な会話のように、わかりやすく、親しみやすく解説してください。形式張った説明ではなく、たとえば「おっ、これはいい質問だね！」や「じゃあ、わかりやすく話してみるね」などを交えてください。",
    },
    {
      role: "user",
      content: userMessage,
    },
  ];

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const answer = response.data.choices[0].message.content.trim();

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: answer,
    });
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "ごめんね、くまお先生ちょっと疲れちゃったみたい…もう一度試してくれるかな？",
    });
  }
}

app.listen(3000, () => {
  console.log("Bot is running on port 3000");
});
