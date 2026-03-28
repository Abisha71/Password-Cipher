// ============================================================
// PASSWORD CIPHER - SCRIPT.JS
// ============================================================

// STATE VARIABLES
let masterHash = null;
let entries = [];
let currentFilter = 'all';
let editingId = null;
let lockTimer = null;
let lockSeconds = 120;
let timeLeft = lockSeconds;
let sessionKey = null;

const STORAGE_KEY = 'vault_entries_v2';
const HASH_KEY = 'vault_master_hash';

// ============================================================
// CRYPTO FUNCTIONS
// ============================================================
function hashPassword(pwd) {
    return CryptoJS.SHA256(pwd + 'vault_salt_2024').toString();
}

function encrypt(text, key) {
    return CryptoJS.AES.encrypt(text, key).toString();
}

function decrypt(cipher, key) {
    try {
        const bytes = CryptoJS.AES.decrypt(cipher, key);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("Decryption failed:", e);
        return '';
    }
}

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const storedHash = localStorage.getItem(HASH_KEY);
    if (!storedHash) {
        document.getElementById('setup-hint').style.display = 'block';
    }

    // Enter key support for master password
    const masterInput = document.getElementById('master-pwd-input');
    if (masterInput) {
        masterInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') handleLogin();
        });
    }
});

// ============================================================
// LOGIN & UNLOCK
// ============================================================
function handleLogin() {
    const pwd = document.getElementById('master-pwd-input').value.trim();
    const status = document.getElementById('login-status');

    if (!pwd) {
        status.textContent = '⚠ PASSWORD REQUIRED';
        status.className = 'login-status error';
        return;
    }

    const storedHash = localStorage.getItem(HASH_KEY);
    const inputHash = hashPassword(pwd);

    if (!storedHash) {
        // First time setup
        localStorage.setItem(HASH_KEY, inputHash);
        masterHash = inputHash;
        status.textContent = '✓ VAULT CREATED SUCCESSFULLY';
        status.className = 'login-status ok';
        setTimeout(() => unlockApp(pwd), 800);
    } else {
        if (inputHash === storedHash) {
            masterHash = inputHash;
            status.textContent = '✓ AUTHENTICATED SUCCESSFULLY';
            status.className = 'login-status ok';
            setTimeout(() => unlockApp(pwd), 600);
        } else {
            status.textContent = '✗ INCORRECT MASTER PASSWORD';
            status.className = 'login-status error';
            document.getElementById('master-pwd-input').value = '';
            document.getElementById('master-pwd-input').focus();
        }
    }
}

function unlockApp(pwd) {
    sessionKey = pwd;
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');

    loadEntries();
    startLockTimer();
    resetActivity();
}

// ============================================================
// AUTO LOCK SYSTEM
// ============================================================
function startLockTimer() {
    timeLeft = lockSeconds;
    clearInterval(lockTimer);
    updateTimerDisplay();

    lockTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(lockTimer);
            lockVault();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').textContent = `LOCKS IN ${m}:${s}`;

    const dot = document.getElementById('timer-dot');
    dot.className = 'dot';
    if (timeLeft <= 30) dot.classList.add('danger');
    else if (timeLeft <= 60) dot.classList.add('warning');
}

function resetActivity() {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => {
        document.addEventListener(event, resetTimer, { passive: true });
    });
}

function resetTimer() {
    if (timeLeft < lockSeconds) {
        timeLeft = lockSeconds;
    }
}

function lockVault() {
    clearInterval(lockTimer);
    document.getElementById('locked-overlay').classList.add('show');
    document.getElementById('reauth-input').value = '';
    document.getElementById('reauth-status').textContent = '';
    setTimeout(() => {
        document.getElementById('reauth-input').focus();
    }, 100);
}

function handleReauth() {
    const pwd = document.getElementById('reauth-input').value.trim();
    const status = document.getElementById('reauth-status');
    const inputHash = hashPassword(pwd);

    if (inputHash === localStorage.getItem(HASH_KEY)) {
        sessionKey = pwd;
        document.getElementById('locked-overlay').classList.remove('show');
        startLockTimer();
        status.textContent = '';
    } else {
        status.textContent = '✗ INCORRECT PASSWORD';
        status.className = 'login-status error';
        document.getElementById('reauth-input').value = '';
    }
}

// ============================================================
// DATA MANAGEMENT
// ============================================================
function loadEntries() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            entries = JSON.parse(raw);
        } catch (e) {
            entries = [];
        }
    } else {
        entries = [];
    }
    renderCards();
    updateBadges();
    updateStats();
}

function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    updateBadges();
    updateStats();
}

// ============================================================
// PASSWORD STRENGTH
// ============================================================
function getStrength(pwd) {
    if (!pwd || pwd.length === 0) return { level: 0, label: '', cls: '' };

    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 14) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 1) return { level: 1, label: 'WEAK', cls: 'weak' };
    if (score <= 2) return { level: 2, label: 'FAIR', cls: 'medium' };
    if (score <= 3) return { level: 3, label: 'GOOD', cls: 'medium' };
    return { level: 4, label: 'STRONG', cls: 'strong' };
}

function checkStrength(val) {
    const s = getStrength(val);
    ['seg1', 'seg2', 'seg3', 'seg4'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) {
            el.className = 'strength-seg';
            if (s.level > i) el.classList.add(s.cls || 'weak');
        }
    });

    const txt = document.getElementById('strength-text');
    if (!val) {
        txt.textContent = '— ENTER PASSWORD';
        txt.style.color = 'var(--text-muted)';
        return;
    }
    txt.textContent = s.label;
    const colorMap = { weak: 'var(--red)', medium: '#ffd600', strong: '#00e676' };
    txt.style.color = colorMap[s.cls] || 'var(--text-muted)';
}

// ============================================================
// RENDER PASSWORD CARDS
// ============================================================
function renderCards() {
    const grid = document.getElementById('pwd-grid');
    const search = document.getElementById('search-input').value.toLowerCase().trim();

    let filtered = entries.filter(e => {
        const matchCat = currentFilter === 'all' || e.category === currentFilter;
        const matchSearch = !search ||
            e.site.toLowerCase().includes(search) ||
            e.username.toLowerCase().includes(search) ||
            (e.url || '').toLowerCase().includes(search);
        return matchCat && matchSearch;
    });

    document.getElementById('entries-count').textContent = `${filtered.length} ENTR${filtered.length !== 1 ? 'IES' : 'Y'}`;

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🔐</div><p>${search ? 'NO RESULTS FOUND' : 'NO ENTRIES YET — CLICK + ADD TO START'}</p></div>`;
        return;
    }

    let html = '';
    filtered.forEach(e => {
                const decPwd = sessionKey ? decrypt(e.encPwd, sessionKey) : '';
                const strength = getStrength(decPwd);
                const catLabels = {
                    work: '💼 WORK',
                    social: '📱 SOCIAL',
                    banking: '💳 BANKING',
                    other: '📦 OTHER'
                };
                const letter = e.site ? e.site[0].toUpperCase() : '?';
                const favicon = e.url ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(e.url)}&sz=40` : null;

                html += `
        <div class="pwd-card" data-id="${e.id}">
            <div class="pwd-card-header">
                <div class="pwd-favicon">
                    ${favicon ? `<img src="${favicon}" onerror="this.style.display='none'; this.nextSibling.style.display='flex'" alt="">` : ''}${letter}
                </div>
                <div class="pwd-info">
                    <div class="pwd-site">${escHtml(e.site)}</div>
                    <div class="pwd-user">${escHtml(e.username)}</div>
                </div>
                <span class="pwd-cat cat-${e.category}">${catLabels[e.category] || e.category}</span>
            </div>
            <div class="pwd-strength">
                <div class="strength-bars">
                    ${[1,2,3,4].map(i => `<div class="strength-bar ${strength.level >= i ? strength.cls : ''}"></div>`).join('')}
                </div>
                <span class="strength-label ${strength.cls}">${strength.label}</span>
            </div>
            <div class="pwd-field">
                <span class="pwd-field-label">PASS</span>
                <span class="pwd-field-val pwd-masked" id="mask-${e.id}">••••••••••</span>
                <button onclick="toggleCardPwd('${e.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:2px;margin-left:4px;" title="Reveal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </div>
            ${e.url ? `<div class="pwd-field"><span class="pwd-field-label">URL</span><span class="pwd-field-val" style="font-size:11px;color:var(--text-muted)">${escHtml(e.url.replace(/^https?:\/\//,''))}</span></div>` : ''}
            <div class="pwd-actions">
                <button class="pwd-action-btn copy" onclick="copyPwd('${e.id}')" title="Copy Password">COPY</button>
                ${e.url ? `<button class="pwd-action-btn open-url" onclick="openUrl('${e.id}')" title="Open URL">OPEN</button>` : ''}
                <button class="pwd-action-btn edit-btn" onclick="openModal('${e.id}')" title="Edit">EDIT</button>
                <button class="pwd-action-btn del-btn" onclick="deleteEntry('${e.id}')" title="Delete">DEL</button>
            </div>
        </div>`;
    });

    grid.innerHTML = html;
}

function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// CARD ACTIONS
// ============================================================
function toggleCardPwd(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const el = document.getElementById(`mask-${id}`);
    if (!el) return;

    if (el.classList.contains('pwd-masked')) {
        const dec = decrypt(entry.encPwd, sessionKey);
        el.textContent = dec || '(decrypt error)';
        el.classList.remove('pwd-masked');
    } else {
        el.textContent = '••••••••••';
        el.classList.add('pwd-masked');
    }
}

function copyPwd(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const dec = decrypt(entry.encPwd, sessionKey);
    if (dec) {
        navigator.clipboard.writeText(dec).then(() => {
            toast('PASSWORD COPIED', 'success');
        });
    }
}

function openUrl(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry || !entry.url) return;
    let url = entry.url;
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    window.open(url, '_blank');
}

function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    entries = entries.filter(e => e.id !== id);
    saveEntries();
    renderCards();
    toast('ENTRY DELETED', 'error');
}

// ============================================================
// FILTER & STATS
// ============================================================
function filterCategory(cat, el) {
    currentFilter = cat;
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    renderCards();
}

function updateBadges() {
    document.getElementById('badge-all').textContent = entries.length;
    const cats = ['work', 'social', 'banking', 'other'];
    cats.forEach(c => {
        const count = entries.filter(e => e.category === c).length;
        const el = document.getElementById(`badge-${c}`);
        if (el) el.textContent = count;
    });
}

function updateStats() {
    document.getElementById('stat-total').textContent = entries.length;
    let strong = 0, weak = 0;
    entries.forEach(e => {
        const dec = decrypt(e.encPwd, sessionKey);
        const s = getStrength(dec);
        if (s.label === 'STRONG') strong++;
        if (s.label === 'WEAK') weak++;
    });
    document.getElementById('stat-strong').textContent = strong;
    document.getElementById('stat-weak').textContent = weak;
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================
function openModal(id = null) {
    editingId = id;
    document.getElementById('modal-title').textContent = id ? 'EDIT ENTRY' : 'ADD ENTRY';
    document.getElementById('gen-panel').classList.remove('open');

    if (id) {
        const e = entries.find(x => x.id === id);
        if (e) {
            document.getElementById('f-site').value = e.site || '';
            document.getElementById('f-user').value = e.username || '';
            document.getElementById('f-url').value = e.url || '';
            document.getElementById('f-cat').value = e.category || 'work';
            document.getElementById('f-notes').value = e.notes || '';
            const dec = decrypt(e.encPwd, sessionKey);
            document.getElementById('f-pwd').value = dec;
            checkStrength(dec);
        }
    } else {
        document.getElementById('f-site').value = '';
        document.getElementById('f-user').value = '';
        document.getElementById('f-url').value = '';
        document.getElementById('f-notes').value = '';
        document.getElementById('f-pwd').value = '';
        document.getElementById('f-cat').value = 'work';
        checkStrength('');
    }

    document.getElementById('modal-backdrop').classList.add('open');
    setTimeout(() => document.getElementById('f-site').focus(), 100);
}

function closeModal() {
    document.getElementById('modal-backdrop').classList.remove('open');
    editingId = null;
}

function saveEntry() {
    const site = document.getElementById('f-site').value.trim();
    const user = document.getElementById('f-user').value.trim();
    const pwd = document.getElementById('f-pwd').value;
    const url = document.getElementById('f-url').value.trim();
    const cat = document.getElementById('f-cat').value;
    const notes = document.getElementById('f-notes').value.trim();

    if (!site) return toast('SITE NAME IS REQUIRED', 'error');
    if (!user) return toast('USERNAME IS REQUIRED', 'error');
    if (!pwd) return toast('PASSWORD IS REQUIRED', 'error');

    const encPwd = encrypt(pwd, sessionKey);

    if (editingId) {
        const idx = entries.findIndex(e => e.id === editingId);
        if (idx > -1) {
            entries[idx] = { ...entries[idx], site, username: user, encPwd, url, category: cat, notes, updatedAt: Date.now() };
        }
        toast('ENTRY UPDATED SUCCESSFULLY', 'success');
    } else {
        entries.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            site, username: user, encPwd, url, category: cat, notes,
            createdAt: Date.now()
        });
        toast('NEW ENTRY SAVED', 'success');
    }

    saveEntries();
    renderCards();
    closeModal();
}

// ============================================================
// PASSWORD GENERATOR
// ============================================================
function toggleGenerator() {
    const panel = document.getElementById('gen-panel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) generatePassword();
}

function generatePassword() {
    const len = parseInt(document.getElementById('gen-len').value);
    const sym = document.getElementById('gen-sym').checked;
    const num = document.getElementById('gen-num').checked;
    const upper = document.getElementById('gen-upper').checked;
    const lower = document.getElementById('gen-lower').checked;

    let chars = '';
    if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (num) chars += '0123456789';
    if (sym) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz';

    let pwd = '';
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) {
        pwd += chars[arr[i] % chars.length];
    }

    document.getElementById('gen-pwd-text').textContent = pwd;
}

function copyGenPwd() {
    const pwd = document.getElementById('gen-pwd-text').textContent;
    if (pwd) {
        navigator.clipboard.writeText(pwd).then(() => toast('GENERATED PASSWORD COPIED', 'success'));
    }
}

function useGeneratedPassword() {
    const pwd = document.getElementById('gen-pwd-text').textContent;
    document.getElementById('f-pwd').value = pwd;
    checkStrength(pwd);
    document.getElementById('gen-panel').classList.remove('open');
    toast('PASSWORD APPLIED TO FIELD', 'info');
}

// ============================================================
// VISIBILITY TOGGLE
// ============================================================
function toggleVis(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';

    btn.innerHTML = isHidden 
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// ============================================================
// EXPORT & IMPORT
// ============================================================
function exportData() {
    const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        entries: entries
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `password-cipher-export-${Date.now()}.json`;
    a.click();
    toast('VAULT EXPORTED SUCCESSFULLY', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const imported = data.entries || data;
            if (!Array.isArray(imported)) throw new Error('Invalid format');

            entries = [...entries, ...imported.filter(x => x.id && x.site)];
            saveEntries();
            renderCards();
            toast(`IMPORTED ${imported.length} ENTRIES`, 'success');
        } catch (err) {
            toast('IMPORT FAILED - INVALID FILE', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 2200);
}

// Close modal when clicking backdrop
document.addEventListener('click', function(e) {
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (e.target === modalBackdrop) {
        closeModal();
    }
});

// Reauth enter key support
const reauthInput = document.getElementById('reauth-input');
if (reauthInput) {
    reauthInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleReauth();
    });
}