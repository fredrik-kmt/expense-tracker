/**
 * Expense Tracker - Main Application
 * ===================================
 * Core functionality for tracking expenses, budgets, and reports
 * Now with Supabase cloud sync!
 */

// ============================================
// App State
// ============================================
const App = {
    currentDate: new Date(),
    pickerYear: new Date().getFullYear(),
    expenses: [],
    budgets: {},
    monthlyIncome: {},
    isLoading: false,

    // Currency configuration
    currency: {
        symbol: 'kr',
        locale: 'da-DK',
        position: 'after'
    }
    // Categories are now managed in categories.js
};

// ============================================
// Currency Formatting
// ============================================
function formatCurrency(amount, showDecimals = true) {
    const value = showDecimals ? amount.toFixed(2) : Math.round(amount).toString();
    const formatted = parseFloat(value).toLocaleString('da-DK', {
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0
    });
    return `${formatted} kr`;
}

// ============================================
// Loading State
// ============================================
function setLoading(loading) {
    App.isLoading = loading;
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
        indicator.classList.toggle('hidden', !loading);
    }
}

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    initializeUI();
    initializeAuthUI();

    // Check for existing session
    try {
        const session = await getSession();
        if (session) {
            currentUser = session.user;
            showApp();
            await loadAllData();
        } else {
            showAuth();
        }
    } catch (error) {
        console.error('Error checking session:', error);
        showAuth();
    }
});

function initializeAuthUI() {
    const authForm = document.getElementById('authForm');
    const signInBtn = document.getElementById('signInBtn');
    const signUpBtn = document.getElementById('signUpBtn');
    const signOutBtn = document.getElementById('signOutBtn');

    // Sign in
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthError();
        setAuthLoading(true);

        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;

        try {
            await signIn(email, password);
        } catch (error) {
            showAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    });

    // Sign up
    signUpBtn.addEventListener('click', async () => {
        hideAuthError();
        setAuthLoading(true);

        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;

        if (!email || !password) {
            showAuthError('Please enter email and password');
            setAuthLoading(false);
            return;
        }

        if (password.length < 6) {
            showAuthError('Password must be at least 6 characters');
            setAuthLoading(false);
            return;
        }

        try {
            await signUp(email, password);
            showAuthError('Account created! Check your email to confirm, then sign in.');
        } catch (error) {
            showAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    });

    // Sign out
    signOutBtn.addEventListener('click', async () => {
        try {
            await signOut();
            App.expenses = [];
            App.budgets = {};
            App.monthlyIncome = {};
        } catch (error) {
            console.error('Sign out error:', error);
        }
    });
}

async function loadAllData() {
    setLoading(true);
    try {
        const [expenses, budgets, income] = await Promise.all([
            fetchExpenses(),
            fetchBudgets(),
            fetchMonthlyIncome()
        ]);

        // Map expenses, migrating old format to new if needed
        App.expenses = expenses.map(e => {
            // Check if expense has new format (parent_category)
            let parentCategory = e.parent_category;
            let subcategory = e.subcategory;

            // If no parent_category, migrate from old category field
            if (!parentCategory && e.category) {
                const migrated = migrateCategory(e.category);
                parentCategory = migrated.parent;
                subcategory = migrated.subcategory;
            }

            return {
                id: e.id,
                description: e.description,
                amount: parseFloat(e.amount),
                parent_category: parentCategory || 'other',
                subcategory: subcategory || null,
                category: e.category, // Keep for backward compatibility
                date: e.date
            };
        });
        App.budgets = budgets;
        App.monthlyIncome = income;

        renderAll();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading data. Please refresh the page.');
    } finally {
        setLoading(false);
    }
}

function initializeUI() {
    // Set default date to today
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Initialize category picker for expense form
    initializeCategoryPicker();

    // Initialize budget category selector
    initializeBudgetCategorySelector();

    // Month navigation
    document.getElementById('prevMonth')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth')?.addEventListener('click', () => changeMonth(1));

    // Month picker
    document.getElementById('monthPickerBtn')?.addEventListener('click', toggleMonthPicker);
    document.getElementById('pickerPrevYear')?.addEventListener('click', () => changePickerYear(-1));
    document.getElementById('pickerNextYear')?.addEventListener('click', () => changePickerYear(1));
    document.getElementById('goToToday')?.addEventListener('click', goToToday);

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
        const picker = document.getElementById('monthPicker');
        const btn = document.getElementById('monthPickerBtn');
        if (picker && btn && !picker.contains(e.target) && e.target !== btn) {
            picker.classList.add('hidden');
        }
    });

    // Section navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => showSection(tab.dataset.section));
    });

    // Forms
    document.getElementById('expenseForm')?.addEventListener('submit', addExpense);
    document.getElementById('budgetForm')?.addEventListener('submit', setBudget);
    document.getElementById('incomeForm')?.addEventListener('submit', setMonthlyIncome);
    document.getElementById('savingsForm')?.addEventListener('submit', addSavings);

    // Data management
    document.getElementById('exportBtn')?.addEventListener('click', exportData);
    document.getElementById('jsonFileInput')?.addEventListener('change', importData);
    document.getElementById('clearDataBtn')?.addEventListener('click', clearAllData);

    // History year selector
    document.getElementById('historyYear')?.addEventListener('change', renderHistory);
}

// ============================================
// Category Picker Initialization
// ============================================
function initializeCategoryPicker() {
    // Expense category picker (only expense categories, no income/savings)
    const expenseContainer = document.getElementById('expenseCategoryPicker');
    if (expenseContainer) {
        expenseContainer.innerHTML = createCategoryPickerHTML('', '', 'categoryPicker', 'expenses');
    }

    // Set default date for expense form
    const today = new Date().toISOString().split('T')[0];
    const expenseDate = document.getElementById('date');
    if (expenseDate) expenseDate.value = today;

    // Set default month for income and savings forms (current month)
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    const incomeMonth = document.getElementById('incomeMonth');
    if (incomeMonth) incomeMonth.value = currentMonth;

    const savingsMonth = document.getElementById('savingsMonth');
    if (savingsMonth) savingsMonth.value = currentMonth;
}

function initializeBudgetCategorySelector() {
    const container = document.getElementById('budgetCategorySelector');
    if (!container) return;

    const categories = getBudgetCategories();
    container.innerHTML = categories.map(cat => `
        <button type="button" class="budget-category-btn" data-category="${cat.key}">
            <span class="icon">${cat.icon}</span>
            <span>${cat.name}</span>
        </button>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.budget-category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove selected from all
            container.querySelectorAll('.budget-category-btn').forEach(b => b.classList.remove('selected'));
            // Add selected to clicked
            btn.classList.add('selected');
            // Update hidden input
            document.getElementById('budgetCategory').value = btn.dataset.category;
        });
    });
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
    const monthText = App.currentDate.toLocaleDateString('en-US', options);

    const el = document.getElementById('currentMonth');
    if (el) {
        el.textContent = monthText;
    }
}

function getCurrentMonthKey() {
    return `${App.currentDate.getFullYear()}-${String(App.currentDate.getMonth() + 1).padStart(2, '0')}`;
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

    document.getElementById(sectionId)?.classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

    if (sectionId === 'reports') {
        renderReports();
    } else if (sectionId === 'history') {
        renderHistory();
    }
}

// ============================================
// Monthly Income
// ============================================
async function setMonthlyIncome(e) {
    e.preventDefault();
    if (App.isLoading) return;

    const amount = parseFloat(document.getElementById('netIncome').value);
    const monthKey = document.getElementById('incomeMonth').value; // YYYY-MM from month picker

    if (!monthKey) {
        alert('Please select a month');
        return;
    }

    setLoading(true);
    try {
        await setMonthlyIncomeInDb(monthKey, amount);
        App.monthlyIncome[monthKey] = amount;
        renderIncomeDisplay();
        renderReports();

        // Reset amount only, keep month selected
        document.getElementById('netIncome').value = '';
    } catch (error) {
        console.error('Error saving income:', error);
        alert('Error saving income. Please try again.');
    } finally {
        setLoading(false);
    }
}

function getMonthlyIncome(monthKey = null) {
    const key = monthKey || getCurrentMonthKey();
    return App.monthlyIncome[key] || 0;
}

function renderIncomeDisplay() {
    const monthKey = getCurrentMonthKey();
    const income = App.monthlyIncome[monthKey];
    const display = document.getElementById('currentIncomeDisplay');
    if (!display) return;

    if (income) {
        display.innerHTML = `
            <div class="income-set">
                <span>This month's income: <strong>${formatCurrency(income)}</strong></span>
                <button class="delete-btn" onclick="deleteMonthlyIncomeHandler()" title="Remove">&times;</button>
            </div>
        `;
    } else {
        display.innerHTML = `<p class="income-not-set">No income set for this month</p>`;
    }
}

async function deleteMonthlyIncomeHandler() {
    if (App.isLoading) return;

    const monthKey = getCurrentMonthKey();

    setLoading(true);
    try {
        await deleteMonthlyIncomeFromDb(monthKey);
        delete App.monthlyIncome[monthKey];
        renderIncomeDisplay();
        renderReports();
    } catch (error) {
        console.error('Error deleting income:', error);
        alert('Error deleting income. Please try again.');
    } finally {
        setLoading(false);
    }
}

// ============================================
// Add Savings
// ============================================
async function addSavings(e) {
    e.preventDefault();
    if (App.isLoading) return;

    // Get selected savings type from radio buttons
    const selectedType = document.querySelector('input[name="savingsType"]:checked');
    const subcategory = selectedType ? selectedType.value : 'Other Savings';

    // Get month and convert to first day of month for date
    const monthValue = document.getElementById('savingsMonth').value; // YYYY-MM
    const date = monthValue + '-01'; // First day of the month

    const savings = {
        description: subcategory, // Use the type as description
        amount: parseFloat(document.getElementById('savingsAmount').value),
        parent_category: 'savings',
        subcategory: subcategory,
        date: date
    };

    setLoading(true);
    try {
        const savedSavings = await addExpenseToDb(savings);
        App.expenses.unshift({
            id: savedSavings.id,
            ...savings
        });
        renderExpenses();
        renderReports();

        // Reset amount only, keep type and month selected for quick multiple entries
        document.getElementById('savingsAmount').value = '';
    } catch (error) {
        console.error('Error adding savings:', error);
        alert('Error adding savings. Please try again.');
    } finally {
        setLoading(false);
    }
}

// ============================================
// Add Expense
// ============================================
async function addExpense(e) {
    e.preventDefault();
    if (App.isLoading) return;

    // Get category from the picker
    const parentCategory = document.getElementById('categoryPicker_parent')?.value;
    const subcategory = document.getElementById('categoryPicker_sub')?.value;

    if (!parentCategory) {
        alert('Please select a category');
        return;
    }

    const expense = {
        description: document.getElementById('description').value.trim(),
        amount: parseFloat(document.getElementById('amount').value),
        parent_category: parentCategory,
        subcategory: subcategory || null,
        date: document.getElementById('date').value
    };

    setLoading(true);
    try {
        const savedExpense = await addExpenseToDb(expense);
        App.expenses.unshift({
            id: savedExpense.id,
            ...expense
        });
        renderExpenses();
        renderBudgets();

        // Reset form
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        document.getElementById('date').value = new Date().toISOString().split('T')[0];

        // Reset category picker to empty
        const expenseContainer = document.getElementById('expenseCategoryPicker');
        if (expenseContainer) {
            expenseContainer.innerHTML = createCategoryPickerHTML('', '', 'categoryPicker', 'expenses');
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('Error adding expense. Please try again.');
    } finally {
        setLoading(false);
    }
}

async function deleteExpense(id) {
    if (App.isLoading) return;

    setLoading(true);
    try {
        await deleteExpenseFromDb(id);
        App.expenses = App.expenses.filter(exp => exp.id !== id);
        renderExpenses();
        renderBudgets();
    } catch (error) {
        console.error('Error deleting expense:', error);
        alert('Error deleting expense. Please try again.');
    } finally {
        setLoading(false);
    }
}

function getMonthExpenses(monthKey = null) {
    const key = monthKey || getCurrentMonthKey();
    return App.expenses.filter(exp => exp.date.startsWith(key));
}

function renderExpenses() {
    const container = document.getElementById('expenseList');
    if (!container) return;

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

    monthExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = monthExpenses.map(exp => {
        const parentCat = exp.parent_category || exp.category || 'other';
        const isIncome = isIncomeCategory(parentCat);
        const isSavings = isSavingsCategory(parentCat);
        const categoryDisplay = formatCategoryDisplay(parentCat, exp.subcategory);
        const catInfo = getCategory(parentCat);

        return `
            <div class="expense-item">
                <div class="expense-info">
                    <div class="description">${escapeHtml(exp.description)}</div>
                    <div class="meta">
                        <span class="category-tag category-tag-${parentCat}">${categoryDisplay}</span>
                        &nbsp;&bull;&nbsp; ${formatDate(exp.date)}
                    </div>
                </div>
                <div class="expense-amount ${isIncome ? 'income' : ''} ${isSavings ? 'savings' : ''}">
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
async function setBudget(e) {
    e.preventDefault();
    if (App.isLoading) return;

    const category = document.getElementById('budgetCategory').value;
    const amount = parseFloat(document.getElementById('budgetAmount').value);

    setLoading(true);
    try {
        await setBudgetInDb(category, amount);
        App.budgets[category] = amount;
        renderBudgets();
        e.target.reset();
    } catch (error) {
        console.error('Error saving budget:', error);
        alert('Error saving budget. Please try again.');
    } finally {
        setLoading(false);
    }
}

async function deleteBudget(category) {
    if (App.isLoading) return;

    setLoading(true);
    try {
        await deleteBudgetFromDb(category);
        delete App.budgets[category];
        renderBudgets();
    } catch (error) {
        console.error('Error deleting budget:', error);
        alert('Error deleting budget. Please try again.');
    } finally {
        setLoading(false);
    }
}

function renderBudgets() {
    const container = document.getElementById('budgetList');
    if (!container) return;

    const monthExpenses = getMonthExpenses();

    // Calculate spending per parent category (excluding income and savings)
    const spending = {};
    monthExpenses.forEach(exp => {
        const parentCat = exp.parent_category || exp.category || 'other';
        // Only count actual expenses (not income, not savings)
        if (isExpenseCategory(parentCat)) {
            spending[parentCat] = (spending[parentCat] || 0) + exp.amount;
        }
    });

    const budgetCategories = Object.keys(App.budgets);
    if (budgetCategories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No budgets set.</p>
                <p>Add a budget above to track your spending limits.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = budgetCategories.map(cat => {
        const limit = App.budgets[cat];
        const spent = spending[cat] || 0;
        const percentage = Math.min((spent / limit) * 100, 100);
        const isOver = spent > limit;
        const color = isOver ? '#ef4444' : (percentage > 80 ? '#f59e0b' : '#10b981');
        const catInfo = getCategory(cat);
        const catName = catInfo ? catInfo.name : getCategoryName(cat);
        const catIcon = catInfo ? catInfo.icon : '';

        return `
            <div class="budget-item">
                <div class="budget-info">
                    <div class="category-name">
                        <span class="category-tag category-tag-${cat}">${catIcon} ${catName}</span>
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
    const netIncome = getMonthlyIncome(monthKey);

    // Categorize transactions by type
    let incomeTotal = 0;
    let expenseTotal = 0;
    let savingsTotal = 0;
    const savingsBreakdown = {};
    const expensesByCategory = {};

    monthExpenses.forEach(exp => {
        const parentCat = exp.parent_category || exp.category || 'other';

        if (isIncomeCategory(parentCat)) {
            incomeTotal += exp.amount;
        } else if (isSavingsCategory(parentCat)) {
            savingsTotal += exp.amount;
            // Track savings by subcategory
            const subKey = exp.subcategory || 'Other Savings';
            savingsBreakdown[subKey] = (savingsBreakdown[subKey] || 0) + exp.amount;
        } else {
            expenseTotal += exp.amount;
            // Track expenses by parent category
            expensesByCategory[parentCat] = (expensesByCategory[parentCat] || 0) + exp.amount;
        }
    });

    // Use manually entered income if available, otherwise use income from transactions
    const totalIncome = netIncome > 0 ? netIncome : incomeTotal;
    const remaining = totalIncome - expenseTotal - savingsTotal;
    const totalBudget = Object.values(App.budgets).reduce((sum, b) => sum + b, 0);
    const budgetRemaining = totalBudget - expenseTotal;

    // Render Money Flow Summary
    const moneyFlowContainer = document.getElementById('moneyFlowSummary');
    if (moneyFlowContainer) {
        moneyFlowContainer.innerHTML = `
            <div class="money-flow-item income">
                <h4>Income</h4>
                <div class="value">${formatCurrency(totalIncome, false)}</div>
            </div>
            <div class="money-flow-item expenses">
                <h4>Expenses</h4>
                <div class="value">${formatCurrency(expenseTotal, false)}</div>
            </div>
            <div class="money-flow-item savings">
                <h4>Savings</h4>
                <div class="value">${formatCurrency(savingsTotal, false)}</div>
            </div>
            <div class="money-flow-item remaining">
                <h4>Remaining</h4>
                <div class="value">${formatCurrency(remaining, false)}</div>
            </div>
        `;
    }

    // Render Summary Cards
    const cardsContainer = document.getElementById('summaryCards');
    if (cardsContainer) {
        cardsContainer.innerHTML = `
            <div class="summary-card ${budgetRemaining >= 0 ? 'success' : 'warning'}">
                <h3>${budgetRemaining >= 0 ? 'Budget Remaining' : 'Over Budget'}</h3>
                <div class="value">${formatCurrency(Math.abs(budgetRemaining), false)}</div>
            </div>
        `;
    }

    // Remove old comparison
    const oldComparison = document.querySelector('.income-vs-expense');
    if (oldComparison) oldComparison.remove();

    // Category Chart (expenses only, not savings)
    const chartContainer = document.getElementById('categoryChart');
    if (chartContainer) {
        const categories = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]);
        const maxSpending = Math.max(...Object.values(expensesByCategory), 1);

        if (categories.length === 0) {
            chartContainer.innerHTML = `
                <div class="empty-state">
                    <p>No spending data to display for this month.</p>
                </div>
            `;
        } else {
            chartContainer.innerHTML = categories.map(([cat, amount]) => {
                const percentage = (amount / maxSpending) * 100;
                const catInfo = getCategory(cat);
                const color = catInfo ? catInfo.color : '#6b7280';
                const name = catInfo ? catInfo.name : getCategoryName(cat);
                const icon = catInfo ? catInfo.icon : '';
                return `
                    <div class="bar-row">
                        <div class="bar-label">${icon} ${name}</div>
                        <div class="bar-container">
                            <div class="bar" style="width: ${Math.max(percentage, 10)}%; background: ${color}">
                                ${formatCurrency(amount)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Savings Breakdown Section
    const savingsSection = document.getElementById('savingsSection');
    const savingsBreakdownContainer = document.getElementById('savingsBreakdown');
    if (savingsSection && savingsBreakdownContainer) {
        if (savingsTotal > 0) {
            savingsSection.classList.remove('hidden');
            savingsBreakdownContainer.innerHTML = Object.entries(savingsBreakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([name, amount]) => `
                    <div class="savings-item">
                        <span class="name">${name}</span>
                        <span class="amount">${formatCurrency(amount)}</span>
                    </div>
                `).join('');
        } else {
            savingsSection.classList.add('hidden');
        }
    }
}

// ============================================
// History
// ============================================
function renderHistory() {
    const years = getAvailableYears();
    const yearSelect = document.getElementById('historyYear');
    if (!yearSelect) return;

    const currentSelectedYear = parseInt(yearSelect.value) || new Date().getFullYear();

    yearSelect.innerHTML = years.map(year =>
        `<option value="${year}" ${year === currentSelectedYear ? 'selected' : ''}>${year}</option>`
    ).join('');

    const selectedYear = parseInt(yearSelect.value);
    renderHistoryGrid(selectedYear);
    renderTrendChart(selectedYear);
}

function getAvailableYears() {
    const years = new Set();
    const currentYear = new Date().getFullYear();

    years.add(currentYear);
    years.add(currentYear - 1);

    App.expenses.forEach(exp => {
        const year = parseInt(exp.date.split('-')[0]);
        years.add(year);
    });

    return Array.from(years).sort((a, b) => b - a);
}

function renderHistoryGrid(year) {
    const container = document.getElementById('historyGrid');
    if (!container) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    const currentMonthKey = getCurrentMonthKey();

    const cards = monthNames.map((name, index) => {
        const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
        const monthExpenses = getMonthExpenses(monthKey);
        // Only count actual expenses (not income, not savings)
        const total = monthExpenses
            .filter(e => {
                const parentCat = e.parent_category || e.category || 'other';
                return isExpenseCategory(parentCat);
            })
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
    if (!container) return;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const monthlySpending = monthNames.map((_, index) => {
        const monthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
        const monthExpenses = getMonthExpenses(monthKey);
        // Only count actual expenses (not income, not savings)
        return monthExpenses
            .filter(e => {
                const parentCat = e.parent_category || e.category || 'other';
                return isExpenseCategory(parentCat);
            })
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
        version: '2.0'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (!confirm('This will add the imported data to your existing data. Continue?')) {
                return;
            }

            setLoading(true);

            // Import expenses
            if (data.expenses && Array.isArray(data.expenses)) {
                for (const exp of data.expenses) {
                    try {
                        await addExpenseToDb(exp);
                    } catch (err) {
                        console.error('Error importing expense:', err);
                    }
                }
            }

            // Import budgets
            if (data.budgets && typeof data.budgets === 'object') {
                for (const [category, amount] of Object.entries(data.budgets)) {
                    try {
                        await setBudgetInDb(category, amount);
                    } catch (err) {
                        console.error('Error importing budget:', err);
                    }
                }
            }

            // Import monthly income
            if (data.monthlyIncome && typeof data.monthlyIncome === 'object') {
                for (const [monthKey, amount] of Object.entries(data.monthlyIncome)) {
                    try {
                        await setMonthlyIncomeInDb(monthKey, amount);
                    } catch (err) {
                        console.error('Error importing income:', err);
                    }
                }
            }

            await loadAllData();
            alert('Data imported successfully!');
        } catch (err) {
            alert('Error importing data. Please check the file format.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function clearAllData() {
    if (!confirm('Are you sure you want to delete ALL data?\n\nThis action cannot be undone!')) {
        return;
    }
    if (!confirm('This will permanently delete all your expenses, budgets, and income data. Are you absolutely sure?')) {
        return;
    }

    setLoading(true);
    try {
        // Delete all expenses
        for (const exp of App.expenses) {
            await deleteExpenseFromDb(exp.id);
        }

        // Delete all budgets
        for (const category of Object.keys(App.budgets)) {
            await deleteBudgetFromDb(category);
        }

        // Delete all monthly income
        for (const monthKey of Object.keys(App.monthlyIncome)) {
            await deleteMonthlyIncomeFromDb(monthKey);
        }

        App.expenses = [];
        App.budgets = {};
        App.monthlyIncome = {};
        renderAll();
        alert('All data has been cleared.');
    } catch (error) {
        console.error('Error clearing data:', error);
        alert('Error clearing data. Please try again.');
    } finally {
        setLoading(false);
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

    if (document.getElementById('reports')?.classList.contains('active')) {
        renderReports();
    }
    if (document.getElementById('history')?.classList.contains('active')) {
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

// Make functions available globally
window.deleteExpense = deleteExpense;
window.deleteBudget = deleteBudget;
window.deleteMonthlyIncomeHandler = deleteMonthlyIncomeHandler;
window.selectMonth = selectMonth;
window.jumpToMonth = jumpToMonth;
window.addSavings = addSavings;
