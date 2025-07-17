try {
  const events = req.body.events;
  for (const event of events) {
    console.log(JSON.stringify(event, null, 2));

    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;

      let replyMessage = '';

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
  }

  res.status(200).send('OK');
} catch (error) {
  console.error('エラーが発生しました:', error);
  res.status(500).send('サーバーエラー');
}
