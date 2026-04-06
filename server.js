import express from "express";
import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname対応
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");

// 同時実行制限（クラッシュ防止）
let isBusy = false;

// ========================
// 🔥 プロキシ（Puppeteer版）
// ========================
app.get("/proxy", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.send("URL required");
  }

  if (isBusy) {
    return res.send("Server busy, try again");
  }

  isBusy = true;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process"
      ]
    });

    const page = await browser.newPage();

    // User-Agent偽装
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    // 軽量化（最低限だけブロック）
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();

      if (["font"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // ページ読み込み（軽め設定）
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });

    const html = await page.content();

    await browser.close();
    isBusy = false;

    res.send(html);

  } catch (err) {
    console.error("ERROR:", err); // ←ログ出力

    if (browser) await browser.close();
    isBusy = false;

    res.send("Error: " + err.message);
  }
});

// ========================
// 🔥 トップページ
// ========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ========================
// 静的ファイル
// ========================
app.use(express.static("public"));

// ========================
// 🚀 サーバー起動
// ========================
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
