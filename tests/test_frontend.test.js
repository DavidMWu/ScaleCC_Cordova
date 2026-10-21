const test = require('node:test');
const assert = require('node:assert');

// Test suite for frontend caption handling logic
test('room slug generation transforms spaces and uppercase', () => {
    function toRoomSlug(roomSelection) {
        return roomSelection.replace(/ /g, '-').toLowerCase();
    }

    assert.strictEqual(toRoomSlug('Ballroom A'), 'ballroom-a');
    assert.strictEqual(toRoomSlug('Room 101'), 'room-101');
    assert.strictEqual(toRoomSlug('Ballroom DE'), 'ballroom-de');
    assert.strictEqual(toRoomSlug('TEST'), 'test');
});

test('dataHistory maintains deeper history (up to 50 items) and suppresses duplicates', () => {
    const MAX_HISTORY = 50;
    let dataHistory = [];

    function processIncomingCaption(captionText, time) {
        const lastEntry = dataHistory[dataHistory.length - 1];
        if (!lastEntry || lastEntry.text !== captionText) {
            dataHistory.push({ text: captionText, time: time || '12:00:00 PM' });
            if (dataHistory.length > MAX_HISTORY) {
                dataHistory.shift();
            }
        }
    }

    // Add first item
    processIncomingCaption('Line 1');
    assert.strictEqual(dataHistory.length, 1);
    assert.strictEqual(dataHistory[0].text, 'Line 1');

    // Duplicate consecutive item should not be added
    processIncomingCaption('Line 1');
    assert.strictEqual(dataHistory.length, 1);

    // Add 60 unique items
    for (let i = 2; i <= 60; i++) {
        processIncomingCaption(`Line ${i}`);
    }

    // Should be clamped to max 50
    assert.strictEqual(dataHistory.length, 50);
    assert.strictEqual(dataHistory[0].text, 'Line 11');
    assert.strictEqual(dataHistory[49].text, 'Line 60');
});

test('caption DOM construction safely renders accessible cards with timestamps and live badge', () => {
    class MockElement {
        constructor(tagName) {
            this.tagName = tagName;
            this.className = '';
            this.textContent = '';
            this.attributes = {};
            this.children = [];
        }
        setAttribute(name, val) {
            this.attributes[name] = val;
        }
        appendChild(child) {
            this.children.push(child);
        }
    }

    function renderCaptions(history) {
        const container = new MockElement('div');
        for (let i = 0; i < history.length; i++) {
            const item = history[i];
            const isLatest = (i === history.length - 1);

            const card = new MockElement('article');
            card.className = isLatest ? 'caption-card active-card' : 'caption-card history-card';

            const metaEl = new MockElement('div');
            metaEl.className = 'caption-meta';

            if (isLatest) {
                const badgeEl = new MockElement('span');
                badgeEl.className = 'caption-badge';
                badgeEl.textContent = '● LIVE';
                metaEl.appendChild(badgeEl);
            }

            const timeEl = new MockElement('span');
            timeEl.className = 'caption-time';
            timeEl.textContent = item.time;
            metaEl.appendChild(timeEl);

            const bodyEl = new MockElement('div');
            bodyEl.className = 'caption-body';
            bodyEl.textContent = item.text;

            card.appendChild(metaEl);
            card.appendChild(bodyEl);
            container.appendChild(card);
        }
        return container;
    }

    const sampleHistory = [
        { text: 'Previous speech transcript.', time: '10:14:00 AM' },
        { text: 'Current live speech transcript.', time: '10:14:15 AM' }
    ];

    const container = renderCaptions(sampleHistory);
    assert.strictEqual(container.children.length, 2);

    // First card (history)
    const card1 = container.children[0];
    assert.strictEqual(card1.className, 'caption-card history-card');
    assert.strictEqual(card1.children[0].children[0].textContent, '10:14:00 AM');
    assert.strictEqual(card1.children[1].textContent, 'Previous speech transcript.');

    // Second card (active)
    const card2 = container.children[1];
    assert.strictEqual(card2.className, 'caption-card active-card');
    assert.strictEqual(card2.children[0].children[0].textContent, '● LIVE');
    assert.strictEqual(card2.children[0].children[1].textContent, '10:14:15 AM');
    assert.strictEqual(card2.children[1].textContent, 'Current live speech transcript.');

    // XSS safety check
    const xssPayload = '<img src=x onerror=alert(1)>';
    const xssContainer = renderCaptions([{ text: xssPayload, time: '12:00:00 PM' }]);
    assert.strictEqual(xssContainer.children[0].children[1].textContent, xssPayload);
});

test('changing room resets dataHistory and clears the chat display', () => {
    let dataHistory = [{ text: 'Old caption 1', time: '1:00 PM' }];
    let container = { textContent: 'Old caption 1', innerHTML: '' };

    function onRoomChange(roomSelection) {
        dataHistory = [];
        if (roomSelection === '') {
            container.innerHTML = '<div class="empty-state">Please select a room.</div>';
            return;
        }
        container.innerHTML = '<div class="empty-state">Connecting...</div>';
    }

    // Switch to a new room
    onRoomChange('TEST');
    assert.deepStrictEqual(dataHistory, []);
    assert.ok(container.innerHTML.includes('Connecting...'));

    // Deselect room
    onRoomChange('');
    assert.deepStrictEqual(dataHistory, []);
    assert.ok(container.innerHTML.includes('Please select a room.'));
});

test('font size controls correctly increment, decrement, clamp and reset', () => {
    const DEFAULT_FONT_SIZE = 26;
    const MIN_FONT_SIZE = 16;
    const MAX_FONT_SIZE = 64;
    const FONT_SIZE_STEP = 4;
    let currentFontSize = DEFAULT_FONT_SIZE;

    function increase() {
        if (currentFontSize + FONT_SIZE_STEP <= MAX_FONT_SIZE) {
            currentFontSize += FONT_SIZE_STEP;
        } else {
            currentFontSize = MAX_FONT_SIZE;
        }
    }

    function decrease() {
        if (currentFontSize - FONT_SIZE_STEP >= MIN_FONT_SIZE) {
            currentFontSize -= FONT_SIZE_STEP;
        } else {
            currentFontSize = MIN_FONT_SIZE;
        }
    }

    function reset() {
        currentFontSize = DEFAULT_FONT_SIZE;
    }

    assert.strictEqual(currentFontSize, 26);
    increase();
    assert.strictEqual(currentFontSize, 30);
    decrease();
    assert.strictEqual(currentFontSize, 26);
    reset();
    assert.strictEqual(currentFontSize, 26);

    for (let i = 0; i < 10; i++) decrease();
    assert.strictEqual(currentFontSize, 16);

    for (let i = 0; i < 30; i++) increase();
    assert.strictEqual(currentFontSize, 64);
});

test('display & vision profile switching handles CVD profiles and high contrast', () => {
    let classList = new Set();
    let storedProfile = null;

    function applyColorBlindProfile(profile) {
        classList.delete('cvd-deuteranopia');
        classList.delete('cvd-tritanopia');
        classList.delete('cvd-monochrome');
        classList.delete('high-contrast');
        if (profile === 'high-contrast') {
            classList.add('high-contrast');
        } else if (profile && profile !== 'none') {
            classList.add('cvd-' + profile);
        }
        storedProfile = profile || 'none';
    }

    applyColorBlindProfile('none');
    assert.strictEqual(classList.size, 0);

    applyColorBlindProfile('deuteranopia');
    assert.strictEqual(classList.has('cvd-deuteranopia'), true);

    applyColorBlindProfile('high-contrast');
    assert.strictEqual(classList.has('high-contrast'), true);

    applyColorBlindProfile('tritanopia');
    assert.strictEqual(classList.has('cvd-tritanopia'), true);

    applyColorBlindProfile('monochrome');
    assert.strictEqual(classList.has('cvd-monochrome'), true);
});

test('debug mode toggle shows or hides the TEST room option and resets room if active', () => {
    const testOption = { hidden: false, disabled: false };
    let currentRoom = 'TEST';
    let storedDebug = null;

    function applyDebugMode(enabled) {
        testOption.hidden = !enabled;
        testOption.disabled = !enabled;

        if (!enabled && currentRoom === 'TEST') {
            currentRoom = '';
        }
        storedDebug = enabled ? 'true' : 'false';
    }

    // Enabled
    applyDebugMode(true);
    assert.strictEqual(testOption.hidden, false);
    assert.strictEqual(testOption.disabled, false);
    assert.strictEqual(currentRoom, 'TEST');
    assert.strictEqual(storedDebug, 'true');

    // Disabled - should hide TEST room and reset selection
    applyDebugMode(false);
    assert.strictEqual(testOption.hidden, true);
    assert.strictEqual(testOption.disabled, true);
    assert.strictEqual(currentRoom, '');
    assert.strictEqual(storedDebug, 'false');
});

test('status indicator assigns unique geometric shapes for color blindness safety', () => {
    function getStatusShape(state) {
        if (state === 'live') return '●';
        if (state === 'idle') return '○';
        return '!';
    }

    assert.strictEqual(getStatusShape('live'), '●');
    assert.strictEqual(getStatusShape('idle'), '○');
    assert.strictEqual(getStatusShape('error'), '!');
});
