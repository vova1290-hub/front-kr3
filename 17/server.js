const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

// ВСТАВЬТЕ ВАШИ VAPID-КЛЮЧИ
const vapidKeys = {
    publicKey: 'BBWtXVBM_LLpCs-nEQHnO5R1HVQyEQYEEFodmkzJJ-zUXLN6uD99wx06zlbygQ9_4Dv_vadBsntpmGDzHL6tDKo',
    privateKey: 'mxylLAo1cseMbeotM4N_jnqp3lNEHF9gGRg8AvHtJz8'
};

webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './')));

let subscriptions = [];

// Хранилище активных напоминаний
const reminders = new Map();

const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    console.log('Клиент подключён:', socket.id);

    // Обычная заметка
    socket.on('newTask', (task) => {
        console.log('Новая задача:', task);
        io.emit('taskAdded', task);

        const payload = JSON.stringify({
            title: 'Новая заметка',
            body: task.text
        });

        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => {
                console.error('Push error:', err);
            });
        });
    });

    // Новое напоминание
    socket.on('newReminder', (reminder) => {
        const { id, text, reminderTime } = reminder;
        const delay = reminderTime - Date.now();
        
        console.log(`Новое напоминание: ${text}, через ${Math.round(delay / 1000)} сек`);
        
        if (delay <= 0) {
            console.log('Время напоминания уже прошло');
            return;
        }

        const timeoutId = setTimeout(() => {
            console.log(`Отправка напоминания для заметки ${id}: ${text}`);
            
            const payload = JSON.stringify({
                title: '⏰ Напоминание',
                body: text,
                reminderId: id
            });

            subscriptions.forEach(sub => {
                webpush.sendNotification(sub, payload).catch(err => {
                    console.error('Push error:', err);
                });
            });

            reminders.delete(id);
        }, delay);

        reminders.set(id, { timeoutId, text, reminderTime });
        console.log(`Напоминание запланировано. Активных: ${reminders.size}`);
    });

    // Удаление напоминания
    socket.on('deleteReminder', ({ id }) => {
        if (reminders.has(id)) {
            clearTimeout(reminders.get(id).timeoutId);
            reminders.delete(id);
            console.log(`Напоминание ${id} удалено`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Клиент отключён:', socket.id);
    });
});

// Эндпоинт для подписки
app.post('/subscribe', (req, res) => {
    subscriptions.push(req.body);
    console.log('Новая подписка, всего:', subscriptions.length);
    res.status(201).json({ message: 'Подписка сохранена' });
});

// Эндпоинт для отписки
app.post('/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
    console.log('Подписка удалена, осталось:', subscriptions.length);
    res.status(200).json({ message: 'Подписка удалена' });
});

// Эндпоинт для откладывания напоминания
app.post('/snooze', (req, res) => {
    const reminderId = parseInt(req.query.reminderId, 10);
    
    console.log(`Запрос на откладывание напоминания ${reminderId}`);
    
    if (!reminderId || !reminders.has(reminderId)) {
        return res.status(400).json({ error: 'Reminder not found' });
    }

    const reminder = reminders.get(reminderId);
    clearTimeout(reminder.timeoutId);

    const newDelay = 5 * 60 * 1000; // 5 минут
    const newTimeoutId = setTimeout(() => {
        console.log(`Отправка отложенного напоминания для ${reminderId}: ${reminder.text}`);
        
        const payload = JSON.stringify({
            title: '⏰ Напоминание (отложено)',
            body: reminder.text,
            reminderId: reminderId
        });

        subscriptions.forEach(sub => {
            webpush.sendNotification(sub, payload).catch(err => {
                console.error('Push error:', err);
            });
        });

        reminders.delete(reminderId);
    }, newDelay);

    reminders.set(reminderId, {
        timeoutId: newTimeoutId,
        text: reminder.text,
        reminderTime: Date.now() + newDelay
    });

    console.log(`Напоминание ${reminderId} отложено на 5 минут`);
    res.status(200).json({ message: 'Reminder snoozed for 5 minutes' });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});