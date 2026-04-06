import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname対応（ESM用）
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");

// ========================
// 🔥 プロキシ機能
// ========================
app.get("/proxy", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.send("URL required");
  }

  try {
    const response = await fetch(url);
    const text = await response.text();

    res.send(text);
  } catch (err) {
    res.send("Error fetching page");
  }
});

// ========================
// 🔥 トップページ（これがNot Found対策）
// ========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ========================
// 🔥 静的ファイル
// ========================
app.use(express.static("public"));

// ========================
// 🚀 サーバー起動
// ========================
app.listen(PORT, () => {
  console.log("Server running");
});
