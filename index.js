import express from "express";
import axios from "axios";
import { middleware, Client } from "@line/bot-sdk";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

// __dirname の代替 (ESM 用)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();
const client = new Client(config);

// POST /webhook
app.post("/webhook", middleware(config), async (req, res) => {
  Promise.all(req.body.events.map(async (event) => {
    if (event.type === "message" && event.message.type === "text") {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "こんにちは、くまお先生だよ！画像送ってくれてもいいよ🐻✨",
      });
    }
  }))
  .then(() => res.status(200).end())
  .catch((err) => {
    console.error("エラー:", err);
    res.status(500).end();
  });
});

// ポート起動
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
