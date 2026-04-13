# Фронтенд и бэкенд разработка — Практические работы 13-18

## Беломытцев Владимир Алексеевич

front-kr3/
├── 13-14/ # Service Worker + PWA + офлайн
├── 15-16/ # HTTPS + App Shell + WebSocket + Push
├── 17/ # Напоминания + откладывание (финальная версия)
└── README.md # Этот файл

### Практики 13-14
```bash
cd 13-14
http-server -p 4000
# Открыть http://localhost:4000

Практика 15 (HTTPS)
cd 15-16
http-server --ssl --cert localhost+2.pem --key localhost+2-key.pem -p 4001
# Открыть https://localhost:4001

Практика 16 (WebSocket + Push)
cd 15-16
node server.js
# Открыть http://localhost:3001 (две вкладки)

Практика 17 (Напоминания) 
cd 17
node server.js
# Открыть http://localhost:3001

Технологии:

HTML/CSS/JS

Service Worker (PWA)

Web App Manifest

WebSocket (Socket.IO)

Push уведомления (web-push)

Express.js

localStorage