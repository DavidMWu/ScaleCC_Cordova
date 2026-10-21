/*
 * SCALE Closed Captioning - Accessible Live Subtitles
 * Designed with WCAG AAA contrast, clear typography, and assistive listening support.
 */

let intervalId = null;
let dataHistory = [];

const DEFAULT_FONT_SIZE = 26;
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 64;
const FONT_SIZE_STEP = 4;
const MAX_HISTORY_LENGTH = 50;
let currentFontSize = DEFAULT_FONT_SIZE;

// DOM Elements
const roomListEl = document.getElementById('roomList');
const incBtn = document.getElementById('fontSizeIncBtn');
const decBtn = document.getElementById('fontSizeDecBtn');
const resetBtn = document.getElementById('fontSizeResetBtn');
const statusBadgeEl = document.getElementById('statusBadge');
const statusIconEl = document.getElementById('statusIcon');
const statusTextEl = document.getElementById('statusText');
const containerEl = document.getElementById('closedCaptions');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsDialog = document.getElementById('settingsDialog');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const colorBlindSelect = document.getElementById('colorBlindSelect');
const debugModeToggle = document.getElementById('debugModeToggle');

// Event Listeners
if (roomListEl) {
    roomListEl.addEventListener('change', changeRoom, false);
}
if (incBtn) {
    incBtn.addEventListener('click', increaseFontSize, false);
}
if (decBtn) {
    decBtn.addEventListener('click', decreaseFontSize, false);
}
if (resetBtn) {
    resetBtn.addEventListener('click', resetFontSize, false);
}

// Settings Dialog Listeners
if (settingsBtn && settingsDialog) {
    settingsBtn.addEventListener('click', () => {
        settingsDialog.showModal();
        settingsBtn.setAttribute('aria-expanded', 'true');
    });
}
if (closeSettingsBtn && settingsDialog) {
    closeSettingsBtn.addEventListener('click', () => {
        settingsDialog.close();
        if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
    });
}
if (settingsDialog) {
    settingsDialog.addEventListener('click', (e) => {
        const rect = settingsDialog.getBoundingClientRect();
        const isInDialog = (
            rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
            rect.left <= e.clientX && e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) {
            settingsDialog.close();
            if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
        }
    });
    settingsDialog.addEventListener('close', () => {
        if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
    });
}

// Display & Vision Profile Selection (Including High Contrast)
if (colorBlindSelect) {
    colorBlindSelect.addEventListener('change', () => {
        applyColorBlindProfile(colorBlindSelect.value);
    });
}

function applyColorBlindProfile(profile) {
    document.body.classList.remove('cvd-deuteranopia', 'cvd-tritanopia', 'cvd-monochrome', 'high-contrast');
    if (profile === 'high-contrast') {
        document.body.classList.add('high-contrast');
    } else if (profile && profile !== 'none') {
        document.body.classList.add('cvd-' + profile);
    }
    if (colorBlindSelect) {
        colorBlindSelect.value = profile || 'none';
    }
    try {
        localStorage.setItem('scalecc_color_profile', profile || 'none');
    } catch (_) {}
}

// Debug Mode Control (Shows/Hides the TEST Room)
if (debugModeToggle) {
    debugModeToggle.addEventListener('change', () => {
        applyDebugMode(debugModeToggle.checked);
    });
}

function applyDebugMode(enabled) {
    const testOption = roomListEl ? roomListEl.querySelector('option[value="TEST"]') : null;
    if (testOption) {
        testOption.hidden = !enabled;
        testOption.disabled = !enabled;
    }

    if (!enabled && roomListEl && roomListEl.value === 'TEST') {
        roomListEl.value = '';
        startClosedCaptioning('');
    }

    if (debugModeToggle) {
        debugModeToggle.checked = enabled;
    }

    try {
        localStorage.setItem('scalecc_debug_mode', enabled ? 'true' : 'false');
    } catch (_) {}
}

function initSettings() {
    try {
        const savedProfile = localStorage.getItem('scalecc_color_profile') || 'none';
        applyColorBlindProfile(savedProfile);

        const savedDebug = localStorage.getItem('scalecc_debug_mode');
        // Default to enabled during development
        applyDebugMode(savedDebug === null ? true : savedDebug === 'true');
    } catch (_) {}
}

// Font Size Controls (Applies to captions and informational messages)
function applyFontSize() {
    if (containerEl) {
        containerEl.style.fontSize = currentFontSize + 'px';
    }
}

function increaseFontSize() {
    if (currentFontSize + FONT_SIZE_STEP <= MAX_FONT_SIZE) {
        currentFontSize += FONT_SIZE_STEP;
    } else {
        currentFontSize = MAX_FONT_SIZE;
    }
    applyFontSize();
}

function decreaseFontSize() {
    if (currentFontSize - FONT_SIZE_STEP >= MIN_FONT_SIZE) {
        currentFontSize -= FONT_SIZE_STEP;
    } else {
        currentFontSize = MIN_FONT_SIZE;
    }
    applyFontSize();
}

function resetFontSize() {
    currentFontSize = DEFAULT_FONT_SIZE;
    applyFontSize();
}

// Stream Status Updates (Shape-Coded & Text-Coded for Color Blindness)
function updateStatus(state, label) {
    if (!statusBadgeEl || !statusTextEl) return;
    statusBadgeEl.className = 'status-badge status-' + state;
    statusTextEl.textContent = label;

    if (statusIconEl) {
        if (state === 'live') {
            statusIconEl.textContent = '●'; // Filled disc
        } else if (state === 'idle') {
            statusIconEl.textContent = '○'; // Hollow ring
        } else {
            statusIconEl.textContent = '!'; // Exclamation icon
        }
    }

    statusBadgeEl.setAttribute('aria-label', 'Stream Status: ' + label);
}

// Room Management
function changeRoom() {
    const roomSelection = roomListEl ? roomListEl.value : '';
    startClosedCaptioning(roomSelection);
}

function formatCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getClosedCaptions(roomSelection) {
    const slug = roomSelection.replace(/ /g, '-').toLowerCase();
    const url = '/room/' + slug + '/latest';
    const request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
            try {
                const data = JSON.parse(request.responseText);
                const captionText = (data.text || '').trim();

                if (captionText && captionText !== 'No captions available.') {
                    updateStatus('live', 'Live');
                    const lastEntry = dataHistory[dataHistory.length - 1];

                    if (!lastEntry || lastEntry.text !== captionText) {
                        dataHistory.push({
                            text: captionText,
                            time: formatCurrentTime()
                        });

                        if (dataHistory.length > MAX_HISTORY_LENGTH) {
                            dataHistory.shift();
                        }

                        drawCaptions();
                    }
                } else {
                    updateStatus('idle', 'Listening');
                }
            } catch (err) {
                updateStatus('idle', 'Listening');
            }
        } else {
            updateStatus('error', 'Reconnecting');
        }
    };
    request.onerror = function() {
        updateStatus('error', 'Reconnecting');
    };
    request.send();
}

function drawCaptions() {
    if (!containerEl) return;

    if (dataHistory.length === 0) {
        containerEl.innerHTML = `
            <div class="empty-state">
                <p class="empty-title">Listening for speech...</p>
                <p class="empty-subtitle">Captions will appear automatically as the speaker talks.</p>
            </div>
        `;
        return;
    }

    containerEl.textContent = '';
    for (let i = 0; i < dataHistory.length; i++) {
        const item = dataHistory[i];
        const isLatest = (i === dataHistory.length - 1);

        const card = document.createElement('article');
        card.className = isLatest ? 'caption-card active-card' : 'caption-card history-card';
        card.setAttribute('role', 'article');
        card.setAttribute('aria-label', (isLatest ? 'Active live caption' : 'Previous caption') + ' at ' + item.time);

        // Header metadata with badge and subtle timestamp
        const metaEl = document.createElement('div');
        metaEl.className = 'caption-meta';

        if (isLatest) {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'caption-badge';
            badgeEl.textContent = '● LIVE';
            metaEl.appendChild(badgeEl);
        }

        const timeEl = document.createElement('span');
        timeEl.className = 'caption-time';
        timeEl.textContent = item.time;
        metaEl.appendChild(timeEl);

        // Caption text body
        const bodyEl = document.createElement('div');
        bodyEl.className = 'caption-body';
        bodyEl.textContent = item.text;

        card.appendChild(metaEl);
        card.appendChild(bodyEl);
        containerEl.appendChild(card);
    }

    // Smoothly keep latest card in view
    const lastCard = containerEl.lastElementChild;
    if (lastCard && typeof lastCard.scrollIntoView === 'function') {
        lastCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function startClosedCaptioning(roomSelection) {
    if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
    }

    dataHistory = [];

    if (!roomSelection) {
        updateStatus('idle', 'Standby');
        if (containerEl) {
            containerEl.innerHTML = `
                <div class="empty-state">
                    <p class="empty-title">Please select a conference room to start live captions.</p>
                    <p class="empty-subtitle">Designed for accessibility and assistive listening.</p>
                </div>
            `;
        }
        return;
    }

    updateStatus('idle', 'Connecting');
    if (containerEl) {
        containerEl.innerHTML = `
            <div class="empty-state">
                <p class="empty-title">Connecting to room captions...</p>
                <p class="empty-subtitle">Standby while the audio transcription stream connects.</p>
            </div>
        `;
    }

    getClosedCaptions(roomSelection);
    intervalId = setInterval(getClosedCaptions.bind(undefined, roomSelection), 500);
}

// Initial initialization
initSettings();
applyFontSize();
