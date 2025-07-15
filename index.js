const axios = require("axios");
const cloudinary = require("cloudinary").v2;

// 🔧 Cloudinary設定
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

// 🔁 Cloudinaryにアップロードする関数
async function uploadToCloudinary(imageBuffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: "image" },
      (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload error:", error);
          reject(error);
        } else {
          console.log("✅ Cloudinary upload success:", result.secure_url);
          resolve(result.secure_url);
        }
      }
    ).end(imageBuffer);
  });
}

// 🔁 Visionに投げて回答をもらう処理（LINE画像URL渡すとAI解答が返る）
async function handleImageMessage(fileUrl) {
  try {
    // LINEから画像Buffer取得
    const stream = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(stream.data, "binary");
    console.log("🟡 imageBuffer size:", imageBuffer.length);

    // Cloudinaryにアップロード
    const imageUrl = await uploadToCloudinary(imageBuffer);
    console.log("🟢 Vision APIに送るURL:", imageUrl);

    // Vision APIへ送信
    const visionResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "この画像の内容をわかりやすく解説してください。" },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 1000
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = visionResponse.data.choices[0]?.message?.content || "画像の解説が取得できませんでした。";
    return reply;

  } catch (error) {
    console.error("❌ Vision連携エラー:", error?.response?.data || error.message || error);
    return "画像の処理中にエラーが発生しました💦";
  }
}
