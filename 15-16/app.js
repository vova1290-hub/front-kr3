const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');
const statusDiv = document.getElementById('status');
const socket = io('http://localhost:3001');

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

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('BFUmH8Eo-dQj35CKWMfV8ZhgtUlh9wvwEqFRXbOwJPPX9sjMro3BNQE4KBRUHViN4XRFhfkFIU19gux-M3t1jjk')
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

function setActiveButton(activeId) {
    [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

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

function initNotes() {
    const form = document.getElementById('noteForm');
    const input = document.getElementById('noteInput');
    const list = document.getElementById('notesList');
    
    function loadNotes() {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        
        if (notes.length === 0) {
            list.innerHTML = '<div class="empty-state">Нет заметок</div>';
            return;
        }
        
        list.innerHTML = notes.map((note, index) => `
            <li>
                <span>${escapeHtml(note)}</span>
                <button onclick="deleteNote(${index})">Удалить</button>
            </li>
        `).join('');
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    window.deleteNote = function(index) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes.splice(index, 1);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
    };
    
    function addNote(text) {
        const notes = JSON.parse(localStorage.getItem('notes') || '[]');
        notes.push(text);
        localStorage.setItem('notes', JSON.stringify(notes));
        loadNotes();
        socket.emit('newTask', { text: text });
    }
    
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
    
    loadNotes();
}

function updateStatus() {
    if (navigator.onLine) {
        statusDiv.textContent = 'Вы онлайн';
        statusDiv.className = 'online';
    } else {
        statusDiv.textContent = 'Офлайн режим';
        statusDiv.className = 'offline';
    }
}

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
                
                // ========== КОД С КНОПКАМИ ==========
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
                // ========== КОНЕЦ КОДА С КНОПКАМИ ==========
            })
            .catch(err => console.error('Ошибка SW:', err));
    });
}