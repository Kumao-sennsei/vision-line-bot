// 🌟 たかちゃん専用：くまお先生が優しく面白く返答するLINE Botコード（メッセージ対応100%版）

import express from "express";
import dotenv from "dotenv";
import { middleware, Client } from "@line/bot-sdk";
import axios from "axios";

// .env 読み込み
dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const app = express();
const client = new Client(config);

app.use(middleware(config));
app.use(express.json());

// System prompt：くまお先生のキャラ設定
const systemPrompt = `
あなたは「くまお先生」です。
優しくて面白く、生徒の質問に自然な日本語で丁寧に答えるLINEの先生です。
わかりやすい言葉で、専門用語はかみ砕いて、会話風に教えてあげてください。
質問がよくわからないときも「なるほど、こういうことかな？」と寄り添う形で対応し、必ず返答してください。
`;

// メッセージイベント処理
app.post("/webhook", async (req, res) => {
  try {
    const events = req.body.events;
    const results = await Promise.all(
      events.map(async (event) => {
        if (event.type === "message" && event.message.type === "text") {
          const userMessage = event.message.text;

          const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
              model: "gpt-4o",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
              temperature: 0.8,
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
            }
          );

          const replyText = response.data.choices[0].message.content;

          return client.replyMessage(event.replyToken, {
            type: "text",
            text: replyText,
          });
        } else {
          return Promise.resolve(null); // テキスト以外は無視
        }
      })
    );
    res.status(200).json(results);
  } catch (err) {
    console.error("エラー発生:", err);
    res.status(500).end();
  }
});

// 起動
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("くまお先生、起動中！ポート：" + port);
});
