// scripts/update-schedule.js
import fs from "fs";
import path from "path";
import axios from "axios";
import { JSDOM } from "jsdom";
import { execSync } from "child_process";

// --- Конфигурация ---
const CONFIG = {
  BASE_URL: "https://shtpt.getcourse.ru",
  SCHEDULE_PAGE_URL: "https://shtpt.getcourse.ru/teach/control/stream/view/id/934775562",
  COOKIE: process.env.GETCOURSE_COOKIE
};

const OUTPUT_DIR = "Schedule";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const session = axios.create({
  withCredentials: true,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    Cookie: CONFIG.COOKIE
  }
});

async function downloadFile(url, dest) {
  const response = await session.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(dest, response.data);
  console.log(`⬇️  Скачан ${path.basename(dest)}`);
}

async function convertDocToPng(docPath) {
  console.log(`🧩 Конвертирую ${path.basename(docPath)}...`);
  execSync(`libreoffice --headless --convert-to png --outdir ${OUTPUT_DIR} "${docPath}"`);
}

// --- Главная функция ---
async function updateSchedules() {
  console.log("🔍 Проверяю страницу с расписаниями...");
  const mainPage = await session.get(CONFIG.SCHEDULE_PAGE_URL);
  const dom = new JSDOM(mainPage.data);
  const lessons = dom.window.document.querySelectorAll(".lesson-list li[data-lesson-id]");

  for (const lesson of lessons) {
    const linkEl = lesson.querySelector("a[href]");
    const titleEl = lesson.querySelector(".link.title");
    if (!linkEl || !titleEl) continue;

    const date = titleEl.textContent.trim().split(" ")[0];
    const lessonUrl = `${CONFIG.BASE_URL}${linkEl.getAttribute("href")}`;
    const pngPath = path.join(OUTPUT_DIR, `${date}.png`);

    if (fs.existsSync(pngPath)) {
      console.log(`⏩ ${date}.png уже существует, пропускаю`);
      continue;
    }

    console.log(`📅 Найдено новое расписание на ${date}`);
    const lessonPage = await session.get(lessonUrl);
    const lessonDom = new JSDOM(lessonPage.data);
    const docLink = lessonDom.window.document.querySelector('a[href*=".doc"]');

    if (!docLink) {
      console.log(`⚠️  В уроке ${date} нет .doc файла`);
      continue;
    }

    const fileUrl = docLink.href.startsWith("http")
      ? docLink.href
      : `${CONFIG.BASE_URL}${docLink.href}`;
    const docPath = path.join(OUTPUT_DIR, `${date}.doc`);

    await downloadFile(fileUrl, docPath);
    await convertDocToPng(docPath);
    console.log(`✅ Расписание ${date} обработано!\n`);
  }
}

updateSchedules().catch((err) => {
  console.error("❌ Ошибка выполнения:", err);
  process.exit(1);
});
