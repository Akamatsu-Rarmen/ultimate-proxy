import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");

// ========================
// 🔥 プロキシ（書き換え版）
// ========================
app.get("/proxy", async (req, res) => {
  const target = req.query.url;

  if (!target) {
    return res.send("URL required");
  }

  try {
    const response = await fetch(target);
    let html = await response.text();

    // ===== リンク書き換え =====
    html = html.replace(
      /href="(.*?)"/g,
      (match, url) => {
        if (url.startsWith("http")) {
          return `href="/proxy?url=${encodeURIComponent(url)}"`;
        }
        return match;
      }
    );

    // ===== フォーム書き換え =====
    html = html.replace(
      /<form([^>]*)action="(.*?)"/g,
      (match, attrs, action) => {
        let newUrl;

        if (action.startsWith("http")) {
          newUrl = action;
        } else {
          newUrl = new URL(action, target).href;
        }

        return `<form${attrs} action="/proxy" method="GET">
        <input type="hidden" name="url" value="${newUrl}">`;
      }
    );

    res.send(html);

  } catch (err) {
    res.send("Error loading page");
  }
});

// ========================
// 🔥 トップページ
// ========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ========================
app.use(express.static("public"));

app.listen(PORT, () => {});
