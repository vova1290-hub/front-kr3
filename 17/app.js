const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');
const statusDiv = document.getElementById('status');
const socket = io('http://localhost:3001');

// Генерация уникального ID
function generateId() {
    return Date.now();
}

// Конвертация VAPID ключа
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Подписка на push
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('BBWtXVBM_LLpCs-nEQHnO5R1HVQyEQYEEFodmkzJJ-zUXLN6uD99wx06zlbygQ9_4Dv_vadBsntpmGDzHL6tDKo')
        });
        await fetch('http://localhost:3001/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });
        console.log('Подписка на push отправлена');
    } catch (err) {
        console.error('Ошибка подписки:', err);
    }
}

// Отписка от push
async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
        await fetch('http://localhost:3001/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
        console.log('Отписка выполнена');
    }
}

// Переключение вкладок
function setActiveButton(activeId) {
    [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

// Загрузка контента
async function loadContent(page) {
    try {
        const response = await fetch(`content/${page}.html`);
        const html = await response.text();
        contentDiv.innerHTML = html;
        
        if (page === 'home') {
            initNotes();
        }
    } catch (err) {
        contentDiv.innerHTML = '<p>Ошибка загрузки страницы</p>';
        console.error(err);
    }
}

// Инициализация заметок
function initNotes() {
    const form = document.getElementById('note-form');
    const input = document.getElementById('note-input');
    const reminderForm = document.getElementById('reminder-form');
    const reminderText = document.getElementById('reminder-text');
    const reminderTime = document.getElementById('reminder-time');
    const list = document.getElementById('notes-list');
    
    function loadNotes() {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        
        if (notes.length === 0) {
            list.innerHTML = '<div class="empty-state">Нет заметок</div>';
            return;
        }
        
        list.innerHTML = notes.map((note, index) => {
            let reminderHtml = '';
            if (note.reminder) {
                const date = new Date(note.reminder);
                reminderHtml = `<div class="note-reminder">⏰ Напоминание: ${date.toLocaleString()}</div>`;
            }
            
            return `
                <li class="note-item" data-id="${note.id}">
                    <div class="note-info">
                        <div class="note-text">${escapeHtml(note.text)}</div>
                        ${reminderHtml}
                    </div>
                    <button class="delete-btn" data-id="${note.id}">Удалить</button>
                </li>
            `;
        }).join('');
        
        // Обработчики удаления
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id);
                deleteNoteById(id);
            });
        });
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function deleteNoteById(id) {
        let notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes = notes.filter(note => note.id !== id);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        
        // Сообщаем серверу об удалении напоминания
        socket.emit('deleteReminder', { id: id });
    }
    
    function addNote(text) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const newNote = {
            id: generateId(),
            text: text,
            reminder: null
        };
        notes.push(newNote);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        socket.emit('newTask', { text: text });
    }
    
    function addReminder(text, reminderTimeStr) {
        const reminderTimestamp = new Date(reminderTimeStr).getTime();
        
        if (reminderTimestamp <= Date.now()) {
            alert('Время напоминания должно быть в будущем');
            return;
        }
        
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        const newNote = {
            id: generateId(),
            text: text,
            reminder: reminderTimestamp
        };
        notes.push(newNote);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        
        // Отправляем на сервер для планирования уведомления
        socket.emit('newReminder', {
            id: newNote.id,
            text: text,
            reminderTime: reminderTimestamp
        });
        
        alert('Напоминание запланировано!');
    }
    
    // Обычная форма
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (text) {
                addNote(text);
                input.value = '';
            }
        });
    }
    
    // Форма с напоминанием
    if (reminderForm) {
        reminderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = reminderText.value.trim();
            const time = reminderTime.value;
            if (text && time) {
                addReminder(text, time);
                reminderText.value = '';
                reminderTime.value = '';
            } else {
                alert('Заполните текст и время напоминания');
            }
        });
    }
    
    loadNotes();
}

// Статус сети
function updateStatus() {
    if (navigator.onLine) {
        statusDiv.textContent = 'Вы онлайн';
        statusDiv.className = 'online';
    } else {
        statusDiv.textContent = 'Офлайн режим';
        statusDiv.className = 'offline';
    }
}

// Обработчики вкладок
homeBtn.addEventListener('click', () => {
    setActiveButton('home-btn');
    loadContent('home');
});

aboutBtn.addEventListener('click', () => {
    setActiveButton('about-btn');
    loadContent('about');
});

window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

updateStatus();
loadContent('home');

// WebSocket: получение уведомлений от других клиентов
socket.on('taskAdded', (task) => {
    console.log('Новая задача от другого клиента:', task);
    
    const notification = document.createElement('div');
    notification.textContent = `Новая заметка: ${task.text}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #667eea;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 1000;
        animation: fadeIn 0.3s;
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
});

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('SW зарегистрирован:', reg.scope);
                
                const enableBtn = document.getElementById('enable-push');
                const disableBtn = document.getElementById('disable-push');
                
                if (enableBtn && disableBtn) {
                    enableBtn.addEventListener('click', async () => {
                        if (Notification.permission === 'denied') {
                            alert('Уведомления запрещены. Разрешите в настройках браузера.');
                            return;
                        }
                        if (Notification.permission === 'default') {
                            const permission = await Notification.requestPermission();
                            if (permission !== 'granted') {
                                alert('Необходимо разрешить уведомления.');
                                return;
                            }
                        }
                        await subscribeToPush();
                        enableBtn.style.display = 'none';
                        disableBtn.style.display = 'inline-block';
                    });
                    
                    disableBtn.addEventListener('click', async () => {
                        await unsubscribeFromPush();
                        disableBtn.style.display = 'none';
                        enableBtn.style.display = 'inline-block';
                    });
                }
            })
            .catch(err => console.error('Ошибка SW:', err));
    });
}