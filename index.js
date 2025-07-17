try {
  const events = req.body.events;
  for (const event of events) {
    console.log(JSON.stringify(event, null, 2));

    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text; // 🔧 ここが重要！

      let replyMessage = '';
      if (userMessage.includes("こんにちは")) {
        replyMessage = "こんにちは！くまお先生だよ〜✨ 今日も質問まってるからねっ(●´ω｀●)";
      } else {
        replyMessage = `くまお先生です！あなたの質問『${userMessage}』を受け取りました`;
      }

      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: replyMessage,
      });
    }
  }
} catch (error) {
  console.error('エラー発生:', error);
}
