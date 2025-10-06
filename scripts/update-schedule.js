require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { execSync } = require('child_process');

// --- КОНФИГУРАЦИЯ ---
const CONFIG = {
  GETCOURSE_URL: 'https://shtpt.getcourse.ru',
  SCHEDULE_PAGE_URL: 'https://shtpt.getcourse.ru/teach/control/stream/view/id/934775562',
  COOKIE: process.env.GETCOURSE_COOKIE
};

const DOWNLOADS_DIR = path.join(__dirname, '../Schedule');
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR);

const session = axios.create({
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Cookie': CONFIG.COOKIE
  }
});

// --- Функции ---
async function downloadFile(url, filePath) {
  const writer = fs.createWriteStream(filePath);
  const response = await session({ method: 'GET', url, responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

function convertDocToPng(docPath, pngPath) {
  try {
    execSync(`libreoffice --headless --convert-to png --outdir "${DOWNLOADS_DIR}" "${docPath}"`);
    const generatedName = path.basename(docPath, '.doc') + '.png';
    const generatedPath = path.join(DOWNLOADS_DIR, generatedName);
    if (generatedPath !== pngPath && fs.existsSync(generatedPath)) {
      fs.renameSync(generatedPath, pngPath);
    }
    console.log(`🖼 Конвертирован: ${pngPath}`);
  } catch (e) {
    console.error('❌ Ошибка конвертации:', e.message);
  }
}

// --- Основная функция ---
async function updateSchedules() {
  console.log('🔍 Проверяю страницу с расписаниями...');
  const response = await session.get(CONFIG.SCHEDULE_PAGE_URL);
  const dom = new JSDOM(response.data);
  const lessonElements = dom.window.document.querySelectorAll('.lesson-list li[data-lesson-id]');

  for (const lessonEl of lessonElements) {
    const linkElement = lessonEl.querySelector('a[href]');
    const titleElement = lessonEl.querySelector('.link.title');
    if (!linkElement || !titleElement) continue;

    const lessonUrl = `${CONFIG.GETCOURSE_URL}${linkElement.getAttribute('href')}`;
    const lessonResponse = await session.get(lessonUrl);
    const lessonDom = new JSDOM(lessonResponse.data);
    const fileLink = lessonDom.window.document.querySelector('a[href*=".doc"]');
    if (!fileLink) continue;

    const originalName = fileLink.textContent.trim();
    console.log('Найден файл:', originalName);
    const match = originalName.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (!match) {
      console.log('Не удалось распознать дату в имени файла');
      continue;
    }
    const datePart = match[1];

    const docFileName = `${datePart}.doc`;
    const pngFileName = `${datePart}.png`;
    const docFilePath = path.join(DOWNLOADS_DIR, docFileName);
    const pngFilePath = path.join(DOWNLOADS_DIR, pngFileName);

    if (!fs.existsSync(docFilePath)) {
      const fileUrl = fileLink.href.startsWith('http') ? fileLink.href : `${CONFIG.GETCOURSE_URL}${fileLink.href}`;
      console.log(`⬇️  Скачан ${docFileName}`);
      await downloadFile(fileUrl, docFilePath);

      console.log(`🧩 Конвертирую ${docFileName}...`);
      convertDocToPng(docFilePath, pngFilePath);
    } else {
      console.log(`✔ Уже скачан: ${docFileName}`);
    }
  }

  console.log('✅ Готово!');
}

// --- Запуск ---
updateSchedules().catch(err => console.error('❌ Ошибка:', err));
