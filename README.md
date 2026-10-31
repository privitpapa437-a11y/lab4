# ЛР4. Простий HTTP-сервер на Node.js

Варіант 7, файл `weather.json` (JSON-масив).

## Встановлення
    npm install

## Запуск
    node main.js -i weather.json -h 127.0.0.1 -p 3000

з записом відповіді у файл:

    node main.js -i weather.json -h 127.0.0.1 -p 3000 -o output.json

## Параметри запиту
- `?humidity=true` — додати поле `humidity` (Humidity3pm)
- `?min_rainfall=X` — лише записи з Rainfall > X
