import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fetch from "node-fetch";

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 3000;

app.disable("x-powered-by");

// ========================
// 🔥 プロキシ管理
// ========================
let proxyPool = [];
let workingProxies = [];

// 複数ソースから取得
async function fetchProxies() {
  try {
    const urls = [
      "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
      "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt"
    ];

    let all = [];

    for (const url of urls) {
      const res = await fetch(url);
      const text = await res.text();

      const list = text
        .split("\n")
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => "http://" + p);

      all.push(...list);
    }

    proxyPool = [...new Set(all)];

  } catch {}
}

// ========================
// 🔥 プロキシチェック
// ========================
async function checkProxy(proxy) {
  try {
    const res = await fetch("http://example.com", {
      timeout: 5000,
      headers: { "User-Agent": "Mozilla/5.0" },
      agent: undefined
    });

    return res.ok;
  } catch {
    return false;
  }
}

// ========================
// 🔥 生きてるプロキシ確保
// ========================
async function refreshWorkingProxies() {
  const shuffled = proxyPool.sort(() => 0.5 - Math.random()).slice(0, 30);

  const results = await Promise.all(
    shuffled.map(async (p) => (await checkProxy(p)) ? p : null)
  );

  workingProxies = results.filter(Boolean);
}

// ========================
// 🔥 プロキシ取得
// ========================
function getProxy() {
  if (workingProxies.length === 0) return null;
  return workingProxies[Math.floor(Math.random() * workingProxies.length)];
}

// ========================
// 🔥 Puppeteer
// ========================
async function createBrowser(proxy) {
  return await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      ...(proxy ? [`--proxy-server=${proxy}`] : [])
    ]
  });
}

// ========================
// 🔥 メイン処理（リトライ付き）
// ========================
async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    let browser;

    try {
      const proxy = getProxy();
      browser = await createBrowser(proxy);

      const context = await browser.createBrowserContext();
      const page = await context.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      );

      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9"
      });

      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const type = req.resourceType();
        if (["image", "font", "media"].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 12000
      });

      const content = await page.content();

      await browser.close();
      return content;

    } catch {
      if (browser) await browser.close();
    }
  }

  throw new Error("All retries failed");
}

// ========================
// 🌐 API
// ========================
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.send("URL required");

  try {
    const html = await fetchPage(url, 3);
    res.send(html);
  } catch {
    res.send("Failed after retries");
  }
});

// ========================
// 🔄 定期更新
// ========================
setInterval(fetchProxies, 1000 * 60 * 10);
setInterval(refreshWorkingProxies, 1000 * 60 * 5);

await fetchProxies();
await refreshWorkingProxies();

// ========================
app.use(express.static("public"));

app.listen(PORT, () => {});
