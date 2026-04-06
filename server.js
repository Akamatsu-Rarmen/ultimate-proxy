import express from "express";
import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");

// 同時実行制限
let isBusy = false;

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.send("URL required");

  if (isBusy) {
    return res.send("Server busy");
  }

  isBusy = true;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--autoplay-policy=no-user-gesture-required"
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    // 画像も許可（動画系のため）
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();

      if (["font"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 20000
    });

    const html = await page.content();

    await browser.close();
    isBusy = false;

    res.send(html);

  } catch (err) {
    if (browser) await browser.close();
    isBusy = false;

    res.send("Error loading page");
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(express.static("public"));

app.listen(PORT, () => {});
