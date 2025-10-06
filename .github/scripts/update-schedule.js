const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const CONFIG = {
  GETCOURSE_URL: "https://shtpt.getcourse.ru",
  SCHEDULE_PAGE_URL: "https://shtpt.getcourse.ru/teach/control/stream/view/id/934775562",
  COOKIE: process.env.GETCOURSE_COOKIE,
};

const DOWNLOADS_DIR = path.join(process.cwd(), "Schedule");

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

const session = axios.create({
  withCredentials: true,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Cookie: CONFIG.COOKIE,
  },
});

async function downloadFile(url, filePath) {
  const response = await session({ method: "GET", url, responseType: "arraybuffer" });
  fs.writeFileSync(filePath, response.data);
  console.log(`✅ Файл сохранён: ${filePath}`);
}

async function main() {
  console.log("🔍 Проверяю страницу расписания...");

  const response = await session.get(CONFIG.SCHEDULE_PAGE_URL);
  const dom = new JSDOM(response.data);
  const lessonElements = dom.window.document.querySelectorAll(".lesson-list li[data-lesson-id]");

  for (const lessonEl of lessonElements) {
    const linkElement = lessonEl.querySelector("a[href]");
    const titleElement = lessonEl.querySelector(".link.title");
    if (!linkElement || !titleElement) continue;

    const title = titleElement.textContent.trim();
    const lessonPageUrl = `${CONFIG.GETCOURSE_URL}${linkElement.getAttribute("href")}`;

    const lessonPage = await session.get(lessonPageUrl);
    const lessonDom = new JSDOM(lessonPage.data);
    const fileLink = lessonDom.window.document.querySelector('a[href*=".doc"]');

    if (!fileLink) continue;

    const fileUrl = fileLink.href.startsWith("http")
      ? fileLink.href
      : `${CONFIG.GETCOURSE_URL}${fileLink.href}`;
    const fileName = fileLink.textContent.trim();
    const filePath = path.join(DOWNLOADS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      await downloadFile(fileUrl, filePath);
    } else {
      console.log(`⚪ Уже существует: ${fileName}`);
    }
  }

  console.log("✅ Проверка расписаний завершена!");
}

main().catch((e) => {
  console.error("❌ Ошибка:", e.message);
  process.exit(1);
});
