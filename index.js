require("dotenv").config();
const express = require("express");
const { middleware, Client } = require("@line/bot-sdk");

const app = express();
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(config);

app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;

  // イベントごとに処理
  Promise.all(
    events.map(async (event) => {
      if (event.type === "message" && event.message.type === "text") {
        const replyText = `くまお先生だよ！「${event.message.text}」って言ったね〜`;
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: replyText,
        });
      }
    })
  )
    .then(() => res.status(200).end())
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// Railway用ポート
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
