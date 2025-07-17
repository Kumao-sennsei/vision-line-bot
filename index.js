app.post('/webhook', async (req, res) => {
  console.log("📩 受信イベント:", JSON.stringify(req.body, null, 2)); // ←ログ確認用！

  const events = req.body.events;

  const results = await Promise.all(events.map(async (event) => {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;

      let replyMessage;
      if (userMessage.includes("こんにちは")) {
        replyMessage = "こんにちは！くまお先生だよ〜✨ 今日も質問まってるからねっ(●´ω｀●)";
      } else {
        replyMessage = `くまお先生です！あなたの質問『${userMessage}』を受け取りました`;
      }

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage
      });
    }
  }));

  res.json(results);
});
