app.post('/webhook', async (req, res) => {
  try {
    const events = req.body.events;
    console.log('📨 イベント受信:', events);

    for (const event of events) {
      console.log('👉 個別イベント:', event);

      if (event.message && event.message.type === 'image') {
        const messageId = event.message.id;
        console.log('🖼 画像メッセージID:', messageId);

        const imageBuffer = await getImageBuffer(messageId); // getImageBuffer関数は定義済み？
        console.log('📦 バッファ取得成功');

        const visionResponse = await callOpenAIVisionAPI(imageBuffer);
        console.log('🧠 Vision応答:', visionResponse);

        const replyText = visionResponse || '画像を解析できませんでした。';
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: `くまお先生の回答：${replyText}`,
        });
        console.log('✅ 応答送信完了');
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('🔥 処理中にエラー:', error);
    res.status(500).send('エラーが発生しました');
  }
});
