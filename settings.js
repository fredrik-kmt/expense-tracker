/**
 * User Settings Management
 * =======================
 */

let appSettings = {
    payday_day: 25,
    starting_balance: 0,
    theme: 'light'
};

// ============================================
// Initialization & Logic
// ============================================

async function loadSettings() {
    try {
        const settings = await fetchUserSettings();
        if (settings) {
            appSettings = { ...appSettings, ...settings };
        }
        console.log('Settings loaded:', appSettings);

        // Apply theme immediately if needed (Phase 7)
        // if (appSettings.theme === 'dark') document.body.setAttribute('data-theme', 'dark');

        updateSettingsUI();
        renderMonthProgress();
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

function updateSettingsUI() {
    const paydayInput = document.getElementById('settingPayday');
    const balanceInput = document.getElementById('settingBalance');

    if (paydayInput) paydayInput.value = appSettings.payday_day;
    if (balanceInput) balanceInput.value = appSettings.starting_balance;
}

// ============================================
// Event Handlers
// ============================================

function openSettingsModal() {
    document.getElementById('settingsModal').classList.remove('hidden');
    updateSettingsUI();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
}

async function saveSettings() {
    const paydayInput = document.getElementById('settingPayday');
    const balanceInput = document.getElementById('settingBalance');

    const newSettings = {
        payday_day: parseInt(paydayInput.value, 10),
        starting_balance: parseFloat(balanceInput.value) || 0,
        theme: appSettings.theme // Keep existing theme for now
    };

    const saveBtn = document.getElementById('saveSettingsBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        await updateUserSettings(newSettings);
        appSettings = { ...appSettings, ...newSettings };

        // Refresh app to reflect changes (especially Month definition)
        // We might need to reload the page or re-render everything
        // For now, re-render month progress and maybe trigger a data reload
        renderMonthProgress();
        // If we change payday, the definition of "This Month" changes, so we should reload data
        if (typeof loadAllData === 'function') {
            loadAllData();
        }

        closeSettingsModal();
    } catch (e) {
        alert('Failed to save settings: ' + e.message);
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

// ============================================
// Month Progress Logic
// ============================================

function renderMonthProgress() {
    const container = document.getElementById('monthProgressContainer');
    if (!container) return;

    const now = new Date();
    const currentDay = now.getDate();
    const payday = appSettings.payday_day;

    // Determine the "Current Financial Month"
    // If today is >= payday, we are in the month starting this payday (e.g., Jan 25 - Feb 24)
    // If today is < payday, we are in the month that started last payday (e.g., Dec 25 - Jan 24)

    let startDate, endDate;

    if (currentDay >= payday) {
        // Current month starts on payday of this month
        startDate = new Date(now.getFullYear(), now.getMonth(), payday);
        // Ends on payday of next month - 1 day (roughly)
        // Actually, let's define the period as strictly: Payday to Payday-1
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, payday); // Next payday
    } else {
        // Current month started on payday of PREVIOUS month
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, payday);
        endDate = new Date(now.getFullYear(), now.getMonth(), payday); // This month's payday
    }

    // Total days in this financial month
    const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

    // Days passed since start date
    // We treat "today" as partially passed or fully passed? Let's say we are ON day X.
    const daysPassed = Math.round((now - startDate) / (1000 * 60 * 60 * 24));

    // Days remaining (until next payday)
    const daysRemaining = totalDays - daysPassed;

    // Render HTML
    let html = `
        <div class="progress-header">
            <div class="progress-title">
                <span class="text-sm text-secondary">Financial Month</span>
                <strong>${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong>
            </div>
            <div class="progress-stats">
                <span class="badge badge-info">${daysRemaining} days left</span>
            </div>
        </div>

        <div class="progress-bar-visual">
    `;

    // Visual blocks
    // We want roughly 30 blocks. If days vary, we might just map 1 block = 1 day
    for (let i = 0; i < totalDays; i++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + i);
        const dayNum = dayDate.getDate();

        let statusClass = 'future';
        if (i < daysPassed) statusClass = 'past';
        else if (i === daysPassed) statusClass = 'today';

        // Mark payday (it's actually the start date, but visually users think of "waiting for payday")
        // The End Date IS the next Payday. So the last block is "Day before Payday".
        // Wait, visually, people want to see "How far am I from Payday?"
        // So the target is the End Date.

        const isToday = (i === daysPassed);

        html += `<div class="day-block ${statusClass}" title="${dayDate.toLocaleDateString()}"></div>`;
    }

    html += `</div>`;

    // Stats below bar
    // We need 'available' amount. We can try to grab it from the DOM if calculated, or recalculate.
    // For now, let's just show time stats.

    container.innerHTML = html;
}
