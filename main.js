import http from 'node:http';
import fs from 'node:fs';
import { Command, Option } from 'commander';

// ============================================================
// 1. Розбір параметрів командного рядка (пакет commander)
// ============================================================
const program = new Command();

program
  .name('lab4')
  .description('HTTP-сервер: погодні дані з файлу (варіант 7)')
  .helpOption('--help', 'вивести довідку')
  .addOption(new Option('-i, --input <path>', 'шлях до файлу даних'))
  .addOption(new Option('-h, --host <address>', 'адреса сервера'))
  .addOption(new Option('-p, --port <number>', 'порт сервера'))
  .addOption(new Option('-o, --output <path>', 'файл для запису останньої відповіді'));

program.parse(process.argv);
const options = program.opts();

// ============================================================
// 2. Завершення роботи з повідомленням про помилку
// ============================================================
function fail(message) {
  console.error(message);
  process.exit(1);
}

// ============================================================
// 3. Перевірка обов'язкових опцій
// ============================================================
if (!options.input) fail('Помилка: не задано обов’язкову опцію -i, --input <path>');
if (!options.host) fail('Помилка: не задано обов’язкову опцію -h, --host <address>');
if (!options.port) fail('Помилка: не задано обов’язкову опцію -p, --port <number>');

const port = Number(options.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  fail('Помилка: порт має бути цілим числом від 1 до 65535');
}

// ============================================================
// 4. Допоміжні функції обробки даних
// ============================================================

// Значення з файлу -> число (рядки "29" теж стають числами);
// відсутнє / порожнє / "NA" / null -> null
function toNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === '' || text.toUpperCase() === 'NA') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

// Формування відповіді згідно з варіантом 7
function buildResult(records, withHumidity, minRainfall) {
  const filtered = minRainfall === null
    ? records
    : records.filter((record) => {
        const rainfall = toNumber(record.Rainfall);
        return rainfall !== null && rainfall > minRainfall;
      });

  return filtered.map((record) => {
    const item = {
      rainfall: toNumber(record.Rainfall),
      pressure3pm: toNumber(record.Pressure3pm),
    };
    if (withHumidity) {
      item.humidity = toNumber(record.Humidity3pm);
    }
    return item;
  });
}

// ============================================================
// 5. Відправка відповіді
// ============================================================
function sendRaw(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);

  if (!options.output) {
    sendRaw(res, statusCode, body);
    return;
  }

  fs.writeFile(options.output, body, 'utf8', (err) => {
    if (err) {
      sendRaw(res, 500, JSON.stringify({ error: 'Не вдалося записати файл відповіді' }));
      return;
    }
    sendRaw(res, statusCode, body);
  });
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

// ============================================================
// 6. Обробник HTTP-запиту
// ============================================================
function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  console.log(`${req.method} ${url.pathname}${url.search}`);

  if (url.pathname !== '/') {
    sendError(res, 404, 'Ресурс не знайдено');
    return;
  }

  const withHumidity = url.searchParams.get('humidity') === 'true';
  const minRainfallRaw = url.searchParams.get('min_rainfall');

  let minRainfall = null;
  if (minRainfallRaw !== null) {
    minRainfall = Number(minRainfallRaw);
    if (minRainfallRaw.trim() === '' || !Number.isFinite(minRainfall)) {
      sendError(res, 400, 'Параметр min_rainfall має бути числом');
      return;
    }
  }

  fs.readFile(options.input, 'utf8', (err, content) => {
    if (err) {
      sendError(res, 500, 'Не вдалося прочитати файл даних');
      return;
    }

    let records;
    try {
      records = JSON.parse(content);
    } catch (parseError) {
      sendError(res, 500, 'Файл даних пошкоджено: некоректний JSON');
      return;
    }

    if (!Array.isArray(records)) {
      sendError(res, 500, 'Файл даних має містити JSON-масив');
      return;
    }

    sendJson(res, 200, buildResult(records, withHumidity, minRainfall));
  });
}

// ============================================================
// 7. Перевірка файлу даних і запуск сервера
// ============================================================
fs.stat(options.input, (err, stats) => {
  if (err || !stats.isFile()) {
    fail('Cannot find input file');
  }
  startServer();
});

function startServer() {
  const server = http.createServer(handleRequest);
  server.listen(port, options.host, () => {
    console.log(`Сервер запущено: http://${options.host}:${port}/`);
  });
}
