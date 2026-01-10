/**
 * Expense Tracker - Main Application
 * ===================================
 * Core functionality for tracking expenses, budgets, and reports
 */

// ============================================
// App State
// ============================================
const App = {
    currentDate: new Date(),
    pickerYear: new Date().getFullYear(),
    expenses: [],
    budgets: {},
    monthlyIncome: {}, // Stores monthly net income by month key (e.g., "2025-01": 25000)

    // Currency configuration
    currency: {
        symbol: 'kr',
        locale: 'da-DK',
        position: 'after' // 'before' or 'after'
    },

    // Category configuration
    categories: {
        food: { name: 'Food & Dining', color: '#e65100' },
        transport: { name: 'Transport', color: '#1565c0' },
        utilities: { name: 'Utilities', color: '#c2185b' },
        entertainment: { name: 'Entertainment', color: '#7b1fa2' },
        shopping: { name: 'Shopping', color: '#2e7d32' },
        health: { name: 'Health', color: '#c62828' },
        income: { name: 'Income', color: '#1b5e20' },
        other: { name: 'Other', color: '#546e7a' }
    }
};

// ============================================
// Currency Formatting
// ============================================
function formatCurrency(amount, showDecimals = true) {
    const value = showDecimals ? amount.toFixed(2) : Math.round(amount).toString();
    // Format with Danish thousands separator
    const formatted = parseFloat(value).toLocaleString('da-DK', {
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0
    });
    return `${formatted} kr`;
}

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initializeUI();
    renderAll();
});

function loadData() {
    App.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    App.budgets = JSON.parse(localStorage.getItem('budgets')) || {};
    App.monthlyIncome = JSON.parse(localStorage.getItem('monthlyIncome')) || {};
}

function saveData() {
    localStorage.setItem('expenses', JSON.stringify(App.expenses));
    localStorage.setItem('budgets', JSON.stringify(App.budgets));
    localStorage.setItem('monthlyIncome', JSON.stringify(App.monthlyIncome));
}

function initializeUI() {
    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();

    // Month navigation
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));

    // Month picker
    document.getElementById('monthPickerBtn').addEventListener('click', toggleMonthPicker);
    document.getElementById('pickerPrevYear').addEventListener('click', () => changePickerYear(-1));
    document.getElementById('pickerNextYear').addEventListener('click', () => changePickerYear(1));
    document.getElementById('goToToday').addEventListener('click', goToToday);

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
        const picker = document.getElementById('monthPicker');
        const btn = document.getElementById('monthPickerBtn');
        if (!picker.contains(e.target) && e.target !== btn) {
            picker.classList.add('hidden');
        }
    });

    // Section navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => showSection(tab.dataset.section));
    });

    // Forms
    document.getElementById('expenseForm').addEventListener('submit', addExpense);
    document.getElementById('budgetForm').addEventListener('submit', setBudget);
    document.getElementById('incomeForm').addEventListener('submit', setMonthlyIncome);

    // Data management
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('jsonFileInput').addEventListener('change', importData);
    document.getElementById('clearDataBtn').addEventListener('click', clearAllData);

    // History year selector
    document.getElementById('historyYear').addEventListener('change', renderHistory);
}

// ============================================
// Month Navigation
// ============================================
function changeMonth(delta) {
    App.currentDate.setMonth(App.currentDate.getMonth() + delta);
    updateMonthDisplay();
    renderAll();
}

function updateMonthDisplay() {
    const options = { month: 'long', year: 'numeric' };
    document.getElementById('currentMonth').textContent =
        App.currentDate.toLocaleDateString('en-US', options);
}

function getCurrentMonthKey() {
    return `${App.currentDate.getFullYear()}-${String(App.currentDate.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthKeyFromDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ============================================
// Month Picker
// ============================================
function toggleMonthPicker(e) {
    e.stopPropagation();
    const picker = document.getElementById('monthPicker');
    picker.classList.toggle('hidden');
    if (!picker.classList.contains('hidden')) {
        App.pickerYear = App.currentDate.getFullYear();
        renderMonthPicker();
    }
}

function changePickerYear(delta) {
    App.pickerYear += delta;
    renderMonthPicker();
}

function renderMonthPicker() {
    document.getElementById('pickerYear').textContent = App.pickerYear;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = App.currentDate.getMonth();
    const currentYear = App.currentDate.getFullYear();

    // Find months with data
    const monthsWithData = new Set();
    App.expenses.forEach(exp => {
        if (exp.date.startsWith(App.pickerYear.toString())) {
            const month = parseInt(exp.date.split('-')[1]) - 1;
            monthsWithData.add(month);
        }
    });

    const container = document.getElementById('pickerMonths');
    container.innerHTML = monthNames.map((name, index) => {
        const isActive = index === currentMonth && App.pickerYear === currentYear;
        const hasData = monthsWithData.has(index);
        return `
            <button class="picker-month ${isActive ? 'active' : ''} ${hasData ? 'has-data' : ''}"
                    onclick="selectMonth(${index})">
                ${name}
            </button>
        `;
    }).join('');
}

function selectMonth(monthIndex) {
    App.currentDate = new Date(App.pickerYear, monthIndex, 1);
    document.getElementById('monthPicker').classList.add('hidden');
    updateMonthDisplay();
    renderAll();
}

function goToToday() {
    App.currentDate = new Date();
    App.pickerYear = App.currentDate.getFullYear();
    document.getElementById('monthPicker').classList.add('hidden');
    updateMonthDisplay();
    renderAll();
}

// ============================================
// Section Navigation
// ============================================
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

    if (sectionId === 'reports') {
        renderReports();
    } else if (sectionId === 'history') {
        renderHistory();
    }
}

// ============================================
// Monthly Income
// ============================================
function setMonthlyIncome(e) {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('netIncome').value);
    const monthKey = getCurrentMonthKey();

    App.monthlyIncome[monthKey] = amount;
    saveData();
    renderIncomeDisplay();
    renderReports();

    e.target.reset();
}

function getMonthlyIncome(monthKey = null) {
    const key = monthKey || getCurrentMonthKey();
    return App.monthlyIncome[key] || 0;
}

function renderIncomeDisplay() {
    const monthKey = getCurrentMonthKey();
    const income = App.monthlyIncome[monthKey];
    const display = document.getElementById('currentIncomeDisplay');

    if (income) {
        display.innerHTML = `
            <div class="income-set">
                <span>This month's income: <strong>${formatCurrency(income)}</strong></span>
                <button class="delete-btn" onclick="deleteMonthlyIncome()" title="Remove">&times;</button>
            </div>
        `;
    } else {
        display.innerHTML = `<p class="income-not-set">No income set for this month</p>`;
    }
}

function deleteMonthlyIncome() {
    const monthKey = getCurrentMonthKey();
    delete App.monthlyIncome[monthKey];
    saveData();
    renderIncomeDisplay();
    renderReports();
}

// ============================================
// Expenses
// ============================================
function addExpense(e) {
    e.preventDefault();

    const expense = {
        id: Date.now(),
        description: document.getElementById('description').value.trim(),
        amount: parseFloat(document.getElementById('amount').value),
        category: document.getElementById('category').value,
        date: document.getElementById('date').value
    };

    App.expenses.push(expense);
    saveData();
    renderExpenses();
    renderBudgets();

    e.target.reset();
    document.getElementById('date').valueAsDate = new Date();
}

function deleteExpense(id) {
    App.expenses = App.expenses.filter(exp => exp.id !== id);
    saveData();
    renderExpenses();
    renderBudgets();
}

function getMonthExpenses(monthKey = null) {
    const key = monthKey || getCurrentMonthKey();
    return App.expenses.filter(exp => exp.date.startsWith(key));
}

function renderExpenses() {
    const container = document.getElementById('expenseList');
    const monthExpenses = getMonthExpenses();

    if (monthExpenses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No expenses recorded for this month.</p>
                <p>Add your first expense above!</p>
            </div>
        `;
        return;
    }

    // Sort by date descending
    monthExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = monthExpenses.map(exp => {
        const isIncome = exp.category === 'income';
        return `
            <div class="expense-item">
                <div class="expense-info">
                    <div class="description">${escapeHtml(exp.description)}</div>
                    <div class="meta">
                        <span class="category-tag category-${exp.category}">${App.categories[exp.category]?.name || exp.category}</span>
                        &nbsp;&bull;&nbsp; ${formatDate(exp.date)}
                    </div>
                </div>
                <div class="expense-amount ${isIncome ? 'income' : ''}">
                    ${isIncome ? '+' : '-'}${formatCurrency(exp.amount)}
                </div>
                <button class="delete-btn" onclick="deleteExpense(${exp.id})" title="Delete">&times;</button>
            </div>
        `;
    }).join('');
}

// ============================================
// Budgets
// ============================================
function setBudget(e) {
    e.preventDefault();

    const category = document.getElementById('budgetCategory').value;
    const amount = parseFloat(document.getElementById('budgetAmount').value);

    App.budgets[category] = amount;
    saveData();
    renderBudgets();
    e.target.reset();
}

function deleteBudget(category) {
    delete App.budgets[category];
    saveData();
    renderBudgets();
}

function renderBudgets() {
    const container = document.getElementById('budgetList');
    const monthExpenses = getMonthExpenses();

    // Calculate spending per category (excluding income)
    const spending = {};
    monthExpenses.forEach(exp => {
        if (exp.category !== 'income') {
            spending[exp.category] = (spending[exp.category] || 0) + exp.amount;
        }
    });

    const categories = Object.keys(App.budgets);
    if (categories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No budgets set.</p>
                <p>Add a budget above to track your spending limits.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = categories.map(cat => {
        const limit = App.budgets[cat];
        const spent = spending[cat] || 0;
        const percentage = Math.min((spent / limit) * 100, 100);
        const isOver = spent > limit;
        const color = isOver ? '#e74c3c' : (percentage > 80 ? '#f39c12' : '#27ae60');

        return `
            <div class="budget-item">
                <div class="budget-info">
                    <div class="category-name">
                        <span class="category-tag category-${cat}">${App.categories[cat]?.name || cat}</span>
                    </div>
                    <div class="budget-bar">
                        <div class="budget-bar-fill" style="width: ${percentage}%; background: ${color}"></div>
                    </div>
                </div>
                <div class="budget-numbers">
                    <div class="spent" style="color: ${color}">${formatCurrency(spent)}</div>
                    <div class="limit">of ${formatCurrency(limit)}</div>
                </div>
                <button class="delete-btn" onclick="deleteBudget('${cat}')" title="Remove budget">&times;</button>
            </div>
        `;
    }).join('');
}

// ============================================
// Reports
// ============================================
function renderReports() {
    const monthExpenses = getMonthExpenses();
    const monthKey = getCurrentMonthKey();

    // Get net income for this month
    const netIncome = getMonthlyIncome(monthKey);

    // Separate income transactions and expenses
    const expenseTransactions = monthExpenses.filter(e => e.category !== 'income');
    const incomeTransactions = monthExpenses.filter(e => e.category === 'income');

    const totalSpent = expenseTransactions.reduce((sum, exp) => sum + exp.amount, 0);
    const totalTransactionIncome = incomeTransactions.reduce((sum, exp) => sum + exp.amount, 0);
    const totalBudget = Object.values(App.budgets).reduce((sum, b) => sum + b, 0);
    const budgetRemaining = totalBudget - totalSpent;

    // Calculate savings based on net income
    const savingsFromIncome = netIncome > 0 ? netIncome - totalSpent : 0;
    const savingsPercentage = netIncome > 0 ? ((savingsFromIncome / netIncome) * 100).toFixed(1) : 0;

    // Summary Cards
    const cardsContainer = document.getElementById('summaryCards');
    cardsContainer.innerHTML = `
        <div class="summary-card">
            <h3>Monthly Income</h3>
            <div class="value">${netIncome > 0 ? formatCurrency(netIncome, false) : 'Not set'}</div>
        </div>
        <div class="summary-card warning">
            <h3>Total Spent</h3>
            <div class="value">${formatCurrency(totalSpent, false)}</div>
        </div>
        <div class="summary-card ${savingsFromIncome >= 0 ? 'success' : 'warning'}">
            <h3>${savingsFromIncome >= 0 ? 'Savings' : 'Overspent'}</h3>
            <div class="value">${formatCurrency(Math.abs(savingsFromIncome), false)}</div>
            ${netIncome > 0 ? `<div class="subvalue">${savingsPercentage}% of income</div>` : ''}
        </div>
        <div class="summary-card ${budgetRemaining >= 0 ? 'success' : 'warning'}">
            <h3>${budgetRemaining >= 0 ? 'Budget Remaining' : 'Over Budget'}</h3>
            <div class="value">${formatCurrency(Math.abs(budgetRemaining), false)}</div>
        </div>
    `;

    // Income vs Expenses visualization
    if (netIncome > 0) {
        const incomeVsExpenseHtml = `
            <div class="income-vs-expense">
                <h3 class="chart-title">Income vs. Expenses</h3>
                <div class="comparison-bar">
                    <div class="comparison-income" style="width: 100%">
                        <span>Income: ${formatCurrency(netIncome, false)}</span>
                    </div>
                </div>
                <div class="comparison-bar">
                    <div class="comparison-expense" style="width: ${Math.min((totalSpent / netIncome) * 100, 100)}%">
                        <span>Expenses: ${formatCurrency(totalSpent, false)}</span>
                    </div>
                </div>
            </div>
        `;
        cardsContainer.insertAdjacentHTML('afterend', incomeVsExpenseHtml);
    }

    // Category Chart (expenses only)
    const chartContainer = document.getElementById('categoryChart');
    const spending = {};
    expenseTransactions.forEach(exp => {
        spending[exp.category] = (spending[exp.category] || 0) + exp.amount;
    });

    const categories = Object.entries(spending).sort((a, b) => b[1] - a[1]);
    const maxSpending = Math.max(...Object.values(spending), 1);

    // Remove old income-vs-expense if exists
    const oldComparison = document.querySelector('.income-vs-expense');
    if (oldComparison) oldComparison.remove();

    if (categories.length === 0) {
        chartContainer.innerHTML = `
            <div class="empty-state">
                <p>No spending data to display for this month.</p>
            </div>
        `;
        return;
    }

    chartContainer.innerHTML = categories.map(([cat, amount]) => {
        const percentage = (amount / maxSpending) * 100;
        const color = App.categories[cat]?.color || '#546e7a';
        return `
            <div class="bar-row">
                <div class="bar-label">${App.categories[cat]?.name || cat}</div>
                <div class="bar-container">
                    <div class="bar" style="width: ${Math.max(percentage, 10)}%; background: ${color}">
                        ${formatCurrency(amount)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// History
// ============================================
function renderHistory() {
    // Populate year selector
    const years = getAvailableYears();
    const yearSelect = document.getElementById('historyYear');
    const currentSelectedYear = parseInt(yearSelect.value) || new Date().getFullYear();

    yearSelect.innerHTML = years.map(year =>
        `<option value="${year}" ${year === currentSelectedYear ? 'selected' : ''}>${year}</option>`
    ).join('');

    const selectedYear = parseInt(yearSelect.value);

    // Render month cards
    renderHistoryGrid(selectedYear);

    // Render trend chart
    renderTrendChart(selectedYear);
}

function getAvailableYears() {
    const years = new Set();
    const currentYear = new Date().getFullYear();

    // Always include current year and previous year
    years.add(currentYear);
    years.add(currentYear - 1);

    // Add years from expenses
    App.expenses.forEach(exp => {
        const year = parseInt(exp.date.split('-')[0]);
        years.add(year);
    });

    return Array.from(years).sort((a, b) => b - a);
}

function renderHistoryGrid(year) {
    const container = document.getElementById('historyGrid');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    const currentMonthKey = getCurrentMonthKey();

    const cards = monthNames.map((name, index) => {
        const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
        const monthExpenses = getMonthExpenses(monthKey);
        const total = monthExpenses
            .filter(e => e.category !== 'income')
            .reduce((sum, e) => sum + e.amount, 0);
        const isActive = monthKey === currentMonthKey;

        return `
            <div class="history-card ${isActive ? 'active' : ''}" onclick="jumpToMonth(${year}, ${index})">
                <div class="month-name">${name.substring(0, 3)}</div>
                <div class="amount">${total > 0 ? formatCurrency(total, false) : '-'}</div>
                <div class="transaction-count">${monthExpenses.length} transactions</div>
            </div>
        `;
    });

    container.innerHTML = cards.join('');
}

function renderTrendChart(year) {
    const container = document.getElementById('trendChart');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Get spending for each month
    const monthlySpending = monthNames.map((_, index) => {
        const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
        const monthExpenses = getMonthExpenses(monthKey);
        return monthExpenses
            .filter(e => e.category !== 'income')
            .reduce((sum, e) => sum + e.amount, 0);
    });

    const maxSpending = Math.max(...monthlySpending, 1);

    const bars = monthlySpending.map((amount, index) => {
        const height = (amount / maxSpending) * 100;
        return `
            <div class="trend-bar" style="height: ${Math.max(height, 2)}%"
                 onclick="jumpToMonth(${year}, ${index})">
                <div class="tooltip">${monthNames[index]}: ${formatCurrency(amount)}</div>
            </div>
        `;
    }).join('');

    const labels = monthNames.map(m => `<span>${m}</span>`).join('');

    container.innerHTML = `
        <div style="display: flex; align-items: flex-end; gap: 10px; height: 200px;">
            ${bars}
        </div>
        <div class="trend-labels">${labels}</div>
    `;
}

function jumpToMonth(year, monthIndex) {
    App.currentDate = new Date(year, monthIndex, 1);
    updateMonthDisplay();
    showSection('expenses');
    renderAll();
}

// ============================================
// Data Management
// ============================================
function exportData() {
    const data = {
        expenses: App.expenses,
        budgets: App.budgets,
        monthlyIncome: App.monthlyIncome,
        exportDate: new Date().toISOString(),
        version: '1.1'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (data.expenses && Array.isArray(data.expenses)) {
                App.expenses = data.expenses;
            }
            if (data.budgets && typeof data.budgets === 'object') {
                App.budgets = data.budgets;
            }
            if (data.monthlyIncome && typeof data.monthlyIncome === 'object') {
                App.monthlyIncome = data.monthlyIncome;
            }

            saveData();
            renderAll();
            alert('Data imported successfully!');
        } catch (err) {
            alert('Error importing data. Please check the file format.');
            console.error(err);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (confirm('Are you sure you want to delete ALL data?\n\nThis action cannot be undone!')) {
        if (confirm('This will permanently delete all your expenses, budgets, and income data. Are you absolutely sure?')) {
            App.expenses = [];
            App.budgets = {};
            App.monthlyIncome = {};
            saveData();
            renderAll();
            alert('All data has been cleared.');
        }
    }
}

// ============================================
// Render All
// ============================================
function renderAll() {
    updateMonthDisplay();
    renderExpenses();
    renderBudgets();
    renderIncomeDisplay();

    // Only render reports/history if those sections are active
    if (document.getElementById('reports').classList.contains('active')) {
        renderReports();
    }
    if (document.getElementById('history').classList.contains('active')) {
        renderHistory();
    }
}

// ============================================
// Utilities
// ============================================
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally for onclick handlers
window.deleteExpense = deleteExpense;
window.deleteBudget = deleteBudget;
window.deleteMonthlyIncome = deleteMonthlyIncome;
window.selectMonth = selectMonth;
window.jumpToMonth = jumpToMonth;
