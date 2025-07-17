app.post('/webhook', middleware(config), express.json({ verify: (req, res, buf) => { req.rawBody = buf } }), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === 'message') {
      // 🔵 テキストメッセージ
      if (event.message.type === 'text') {
        const userText = event.message.text;
        try {
          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4',
              messages: [
                { role: 'system', content: 'あなたは優しい数学の先生くまお先生です。生徒の質問にやさしく丁寧に、日本語で解説してください。' },
                { role: 'user', content: userText },
              ],
              max_tokens: 1000,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              },
            }
          );

          const explanation = convertLatexToReadable(response.data.choices[0].message.content);
          lastExplanation = explanation;

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: explanation,
          });
        } catch (err) {
          console.error('テキスト応答エラー:', err.message);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'ごめんね、くまお先生ちょっと休憩中かも？もう一度送ってみてね！',
          });
        }
      }

      // 🟢 画像メッセージ
      else if (event.message.type === 'image') {
        const messageId = event.message.id;
        const stream = await client.getMessageContent(messageId);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const base64Image = buffer.toString('base64');

        try {
          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4-vision-preview',
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'この画像の内容を日本語で解説して。数式はわかりやすく整えてください。' },
                    { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
                  ],
                },
              ],
              max_tokens: 1000,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              },
            }
          );

          const explanation = convertLatexToReadable(response.data.choices[0].message.content);
          lastExplanation = explanation;

          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: explanation,
          });
        } catch (err) {
          console.error('Vision APIエラー:', err.message);
          await client.replyMessage(event.replyToken, {
            type: 'text',
            text: '画像の処理中にエラーが発生しました。画像形式やサイズを確認してください。',
          });
        }
      }
    }
  }
  res.status(200).end();
});
