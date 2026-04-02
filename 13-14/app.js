const form = document.getElementById('noteForm');
const input = document.getElementById('noteInput');
const list = document.getElementById('notesList');
const statusDiv = document.getElementById('status');

function loadNotes() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    
    if (notes.length === 0) {
        list.innerHTML = '<div class="empty-state">Нет заметок. Добавьте первую</div>';
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

function addNote(text) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.push(text);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
}

function deleteNote(index) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.splice(index, 1);
    localStorage.setItem('notes', JSON.stringify(notes));
    loadNotes();
}

window.deleteNote = deleteNote;

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
        addNote(text);
        input.value = '';
    }
});

function updateStatus() {
    if (navigator.onLine) {
        statusDiv.textContent = 'Вы онлайн';
        statusDiv.className = 'online';
    } else {
        statusDiv.textContent = 'Офлайн режим - изменения сохранятся локально';
        statusDiv.className = 'offline';
    }
}

window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

loadNotes();
updateStatus();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW зарегистрирован:', reg.scope))
            .catch(err => console.error('Ошибка SW:', err));
    });
}