import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

// 同時実行制限（超重要）
let isBusy = false;

// シンプルプロキシ
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.send("URL required");

  // 同時実行防止
  if (isBusy) {
    return res.send("Server busy, try again");
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
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    // 軽量化
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (["image", "media", "font"].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 10000
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

app.use(express.static("public"));

app.listen(PORT, () => {});
