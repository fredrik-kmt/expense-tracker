/**
 * Categories Module
 * =================
 * Hierarchical category structure for the expense tracker
 */

// Default category structure
const DEFAULT_CATEGORIES = {
    income: {
        name: 'Income',
        icon: '💰',
        color: '#10b981',
        subcategories: ['Salary', 'Side Income', 'Other Income']
    },
    housing: {
        name: 'Housing',
        icon: '🏠',
        color: '#8b5cf6',
        subcategories: ['Rent/Mortgage', 'Utilities', 'Insurance', 'Maintenance']
    },
    food: {
        name: 'Food',
        icon: '🍽️',
        color: '#f59e0b',
        subcategories: ['Groceries', 'Eating Out', 'Bars & Nightlife', 'Coffee & Snacks']
    },
    transport: {
        name: 'Transport',
        icon: '🚗',
        color: '#3b82f6',
        subcategories: ['Public Transport', 'Car', 'Taxi/Uber', 'Bike']
    },
    subscriptions: {
        name: 'Subscriptions',
        icon: '📱',
        color: '#ec4899',
        subcategories: ['Streaming', 'Software', 'Memberships', 'Other Subscriptions']
    },
    shopping: {
        name: 'Shopping',
        icon: '🛍️',
        color: '#14b8a6',
        subcategories: ['Clothing', 'Electronics', 'Home & Furniture', 'Gifts']
    },
    health: {
        name: 'Health',
        icon: '❤️',
        color: '#ef4444',
        subcategories: ['Medical', 'Pharmacy', 'Fitness', 'Personal Care']
    },
    entertainment: {
        name: 'Entertainment',
        icon: '🎉',
        color: '#f97316',
        subcategories: ['Events & Tickets', 'Hobbies', 'Games', 'Other Entertainment']
    },
    travel: {
        name: 'Travel & Vacation',
        icon: '✈️',
        color: '#06b6d4',
        subcategories: ['Flights', 'Accommodation', 'Activities', 'Travel Food & Transport']
    },
    savings: {
        name: 'Savings & Investments',
        icon: '🏦',
        color: '#22c55e',
        subcategories: ['Emergency Buffer', 'Stocks', 'ETFs/Funds', 'Pension', 'Travel Savings', 'Other Savings'],
        isSavings: true  // Special flag: not counted as spending
    },
    other: {
        name: 'Other',
        icon: '📦',
        color: '#6b7280',
        subcategories: ['Uncategorized']
    }
};

// Category order for display
const CATEGORY_ORDER = [
    'income',
    'housing',
    'food',
    'transport',
    'subscriptions',
    'shopping',
    'health',
    'entertainment',
    'travel',
    'savings',
    'other'
];

// Map old flat categories to new parent categories
const CATEGORY_MIGRATION_MAP = {
    'food': { parent: 'food', subcategory: null },
    'transport': { parent: 'transport', subcategory: null },
    'utilities': { parent: 'housing', subcategory: 'Utilities' },
    'entertainment': { parent: 'entertainment', subcategory: null },
    'shopping': { parent: 'shopping', subcategory: null },
    'health': { parent: 'health', subcategory: null },
    'income': { parent: 'income', subcategory: null },
    'other': { parent: 'other', subcategory: 'Uncategorized' }
};

/**
 * Get all categories with their subcategories
 */
function getCategories() {
    return DEFAULT_CATEGORIES;
}

/**
 * Get categories in display order
 */
function getCategoriesOrdered() {
    return CATEGORY_ORDER.map(key => ({
        key,
        ...DEFAULT_CATEGORIES[key]
    }));
}

/**
 * Get a specific category by key
 */
function getCategory(parentKey) {
    return DEFAULT_CATEGORIES[parentKey] || null;
}

/**
 * Get the display name for a category
 */
function getCategoryName(parentKey) {
    const cat = DEFAULT_CATEGORIES[parentKey];
    return cat ? cat.name : parentKey;
}

/**
 * Get the color for a category
 */
function getCategoryColor(parentKey) {
    const cat = DEFAULT_CATEGORIES[parentKey];
    return cat ? cat.color : '#6b7280';
}

/**
 * Format category display string (e.g., "Food > Groceries")
 */
function formatCategoryDisplay(parentCategory, subcategory) {
    const cat = DEFAULT_CATEGORIES[parentCategory];
    const parentName = cat ? cat.name : parentCategory;

    if (subcategory) {
        return `${parentName} > ${subcategory}`;
    }
    return parentName;
}

/**
 * Check if a category is an income category
 */
function isIncomeCategory(parentCategory) {
    return parentCategory === 'income';
}

/**
 * Check if a category is a savings category
 */
function isSavingsCategory(parentCategory) {
    const cat = DEFAULT_CATEGORIES[parentCategory];
    return cat ? cat.isSavings === true : false;
}

/**
 * Check if a category is an expense (not income or savings)
 */
function isExpenseCategory(parentCategory) {
    return !isIncomeCategory(parentCategory) && !isSavingsCategory(parentCategory);
}

/**
 * Migrate old flat category to new structure
 */
function migrateCategory(oldCategory) {
    const migration = CATEGORY_MIGRATION_MAP[oldCategory];
    if (migration) {
        return migration;
    }
    // Default to other > uncategorized
    return { parent: 'other', subcategory: 'Uncategorized' };
}

/**
 * Get categories for budgets (only expense categories, not savings)
 * Income and Savings are excluded from budgets
 */
function getBudgetCategories() {
    return CATEGORY_ORDER
        .filter(key => key !== 'income' && key !== 'savings')
        .map(key => ({
            key,
            ...DEFAULT_CATEGORIES[key]
        }));
}

/**
 * Create the HTML for the category picker dropdown
 */
function createCategoryPickerHTML(selectedParent = '', selectedSub = '', pickerId = 'categoryPicker') {
    const categories = getCategoriesOrdered();

    let html = `
        <div class="category-picker" id="${pickerId}">
            <button type="button" class="category-picker-btn" onclick="toggleCategoryPicker('${pickerId}')">
                <span class="category-picker-value">
                    ${selectedParent ? formatCategoryDisplay(selectedParent, selectedSub) : 'Select category...'}
                </span>
                <span class="category-picker-arrow">▼</span>
            </button>
            <div class="category-picker-dropdown hidden">
                <div class="category-picker-list">
    `;

    categories.forEach(cat => {
        html += `
            <div class="category-picker-group">
                <div class="category-picker-parent" data-parent="${cat.key}">
                    <span class="category-icon">${cat.icon}</span>
                    <span class="category-name">${cat.name}</span>
                </div>
                <div class="category-picker-subs">
        `;

        cat.subcategories.forEach(sub => {
            html += `
                <div class="category-picker-sub"
                     data-parent="${cat.key}"
                     data-sub="${sub}"
                     onclick="selectCategory('${pickerId}', '${cat.key}', '${sub}')">
                    ${sub}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `
                </div>
            </div>
            <input type="hidden" name="parent_category" id="${pickerId}_parent" value="${selectedParent}">
            <input type="hidden" name="subcategory" id="${pickerId}_sub" value="${selectedSub}">
        </div>
    `;

    return html;
}

/**
 * Toggle category picker dropdown
 */
function toggleCategoryPicker(pickerId) {
    const picker = document.getElementById(pickerId);
    const dropdown = picker.querySelector('.category-picker-dropdown');
    dropdown.classList.toggle('hidden');

    // Close other pickers
    document.querySelectorAll('.category-picker-dropdown').forEach(d => {
        if (d !== dropdown) {
            d.classList.add('hidden');
        }
    });
}

/**
 * Select a category from the picker
 */
function selectCategory(pickerId, parentKey, subcategory) {
    const picker = document.getElementById(pickerId);
    const valueSpan = picker.querySelector('.category-picker-value');
    const parentInput = document.getElementById(`${pickerId}_parent`);
    const subInput = document.getElementById(`${pickerId}_sub`);
    const dropdown = picker.querySelector('.category-picker-dropdown');

    // Update display
    valueSpan.textContent = formatCategoryDisplay(parentKey, subcategory);

    // Update hidden inputs
    parentInput.value = parentKey;
    subInput.value = subcategory;

    // Close dropdown
    dropdown.classList.add('hidden');

    // Trigger change event
    picker.dispatchEvent(new CustomEvent('categorychange', {
        detail: { parent: parentKey, subcategory }
    }));
}

/**
 * Close all category pickers when clicking outside
 */
document.addEventListener('click', (e) => {
    if (!e.target.closest('.category-picker')) {
        document.querySelectorAll('.category-picker-dropdown').forEach(d => {
            d.classList.add('hidden');
        });
    }
});

// Make functions available globally
window.getCategories = getCategories;
window.getCategoriesOrdered = getCategoriesOrdered;
window.getCategory = getCategory;
window.getCategoryName = getCategoryName;
window.getCategoryColor = getCategoryColor;
window.formatCategoryDisplay = formatCategoryDisplay;
window.isIncomeCategory = isIncomeCategory;
window.isSavingsCategory = isSavingsCategory;
window.isExpenseCategory = isExpenseCategory;
window.migrateCategory = migrateCategory;
window.getBudgetCategories = getBudgetCategories;
window.createCategoryPickerHTML = createCategoryPickerHTML;
window.toggleCategoryPicker = toggleCategoryPicker;
window.selectCategory = selectCategory;
