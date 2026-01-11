/**
 * CSV Import Module
 * =================
 * Handles parsing and importing bank statements in CSV format
 */

const CSVImport = {
    parsedData: [],
    headers: [],
    columnMapping: {
        date: 0,
        description: 1,
        amount: 2
    }
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initCSVImport();
});

function initCSVImport() {
    const dropZone = document.getElementById('csvDropZone');
    const fileInput = document.getElementById('csvFileInput');

    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleCSVFile(e.target.files[0]);
        }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.csv')) {
            handleCSVFile(files[0]);
        } else {
            alert('Please drop a CSV file.');
        }
    });

    // Column mapping change handlers
    document.getElementById('csvDateCol').addEventListener('change', updatePreview);
    document.getElementById('csvDescCol').addEventListener('change', updatePreview);
    document.getElementById('csvAmountCol').addEventListener('change', updatePreview);

    // Import/Cancel buttons
    document.getElementById('importCsvBtn').addEventListener('click', importSelectedTransactions);
    document.getElementById('cancelCsvBtn').addEventListener('click', cancelCSVImport);
}

// ============================================
// File Handling
// ============================================
function handleCSVFile(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        const content = e.target.result;
        parseCSV(content);
    };

    reader.onerror = () => {
        alert('Error reading file. Please try again.');
    };

    reader.readAsText(file);
}

function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        alert('CSV file appears to be empty or has no data rows.');
        return;
    }

    // Parse headers and data
    CSVImport.headers = parseCSVLine(lines[0]);
    CSVImport.parsedData = lines.slice(1).map(line => parseCSVLine(line)).filter(row => row.length > 0);

    if (CSVImport.parsedData.length === 0) {
        alert('No data rows found in CSV file.');
        return;
    }

    // Auto-detect column mapping
    autoDetectColumns();

    // Show preview
    showCSVPreview();
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if ((char === ',' || char === ';') && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// ============================================
// Column Detection
// ============================================
function autoDetectColumns() {
    const headers = CSVImport.headers.map(h => h.toLowerCase());

    // Date column detection
    const datePatterns = ['date', 'datum', 'transaction date', 'trans date', 'posted'];
    CSVImport.columnMapping.date = headers.findIndex(h =>
        datePatterns.some(p => h.includes(p))
    );
    if (CSVImport.columnMapping.date === -1) CSVImport.columnMapping.date = 0;

    // Description column detection
    const descPatterns = ['description', 'desc', 'omschrijving', 'details', 'narrative', 'memo', 'payee', 'name'];
    CSVImport.columnMapping.description = headers.findIndex(h =>
        descPatterns.some(p => h.includes(p))
    );
    if (CSVImport.columnMapping.description === -1) CSVImport.columnMapping.description = 1;

    // Amount column detection
    const amountPatterns = ['amount', 'bedrag', 'value', 'sum', 'debit', 'credit'];
    CSVImport.columnMapping.amount = headers.findIndex(h =>
        amountPatterns.some(p => h.includes(p))
    );
    if (CSVImport.columnMapping.amount === -1) CSVImport.columnMapping.amount = 2;
}

// ============================================
// Preview
// ============================================
function showCSVPreview() {
    const preview = document.getElementById('csvPreview');
    preview.classList.remove('hidden');

    // Populate column selectors
    const dateSelect = document.getElementById('csvDateCol');
    const descSelect = document.getElementById('csvDescCol');
    const amountSelect = document.getElementById('csvAmountCol');

    const options = CSVImport.headers.map((h, i) =>
        `<option value="${i}">${h || `Column ${i + 1}`}</option>`
    ).join('');

    dateSelect.innerHTML = options;
    descSelect.innerHTML = options;
    amountSelect.innerHTML = options;

    // Set detected values
    dateSelect.value = CSVImport.columnMapping.date;
    descSelect.value = CSVImport.columnMapping.description;
    amountSelect.value = CSVImport.columnMapping.amount;

    updatePreview();
}

function updatePreview() {
    // Update mapping from selects
    CSVImport.columnMapping.date = parseInt(document.getElementById('csvDateCol').value);
    CSVImport.columnMapping.description = parseInt(document.getElementById('csvDescCol').value);
    CSVImport.columnMapping.amount = parseInt(document.getElementById('csvAmountCol').value);

    const container = document.getElementById('csvTransactions');
    const transactions = CSVImport.parsedData.slice(0, 50); // Show max 50 for preview

    container.innerHTML = transactions.map((row, index) => {
        const date = parseDate(row[CSVImport.columnMapping.date]);
        const description = row[CSVImport.columnMapping.description] || '';
        const amount = parseAmount(row[CSVImport.columnMapping.amount]);
        const categoryInfo = suggestCategory(description);

        if (!date || isNaN(amount)) {
            return ''; // Skip invalid rows
        }

        const isExpense = amount < 0;
        const displayAmount = Math.abs(amount);

        // If it's income (positive amount), suggest income category
        let parent = categoryInfo.parent_category;
        let sub = categoryInfo.subcategory;
        if (!isExpense) {
            parent = 'income';
            sub = 'Other Income';
        }

        return `
            <div class="csv-transaction">
                <input type="checkbox" checked data-index="${index}">
                <div class="info">
                    <div class="desc">${escapeHtml(description.substring(0, 50))}${description.length > 50 ? '...' : ''}</div>
                    <div class="date">${date}</div>
                </div>
                <div class="amount" style="color: ${isExpense ? '#e74c3c' : '#27ae60'}">
                    ${isExpense ? '-' : '+'}${formatCurrency(displayAmount)}
                </div>
                <select class="category-select" data-index="${index}">
                    ${getCategoryOptions(parent, sub)}
                </select>
            </div>
        `;
    }).filter(html => html).join('');

    if (container.innerHTML === '') {
        container.innerHTML = `
            <div class="empty-state">
                <p>Could not parse any valid transactions.</p>
                <p>Try adjusting the column mapping above.</p>
            </div>
        `;
    }
}

// ============================================
// Parsing Utilities
// ============================================
function parseDate(dateStr) {
    if (!dateStr) return null;

    // Try various date formats
    const formats = [
        // ISO format
        /^(\d{4})-(\d{2})-(\d{2})$/,
        // US format MM/DD/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        // European format DD/MM/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        // European format DD-MM-YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        // Format YYYYMMDD
        /^(\d{4})(\d{2})(\d{2})$/
    ];

    // Clean the date string
    dateStr = dateStr.trim().replace(/['"]/g, '');

    // Try ISO first
    let match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    // Try MM/DD/YYYY or DD/MM/YYYY
    match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
        let [_, first, second, year] = match;
        // Assume MM/DD/YYYY for US format, adjust if first > 12
        let month, day;
        if (parseInt(first) > 12) {
            day = first;
            month = second;
        } else {
            month = first;
            day = second;
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try DD/MM/YY or MM/DD/YY
    match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (match) {
        let [_, first, second, year] = match;
        const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
        let month, day;
        if (parseInt(first) > 12) {
            day = first;
            month = second;
        } else {
            month = first;
            day = second;
        }
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try to parse as Date object
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return null;
}

function parseAmount(amountStr) {
    if (!amountStr) return NaN;

    // Clean the string
    let cleaned = amountStr.toString().trim();

    // Remove currency symbols and spaces
    cleaned = cleaned.replace(/[$€£¥₹\s]/g, '');

    // Handle European format (1.234,56 -> 1234.56)
    if (cleaned.match(/\d+\.\d{3},\d{2}$/)) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // Handle format with comma as thousands separator (1,234.56)
    else if (cleaned.match(/\d+,\d{3}\.\d{2}$/)) {
        cleaned = cleaned.replace(/,/g, '');
    }
    // Handle European decimal comma (123,45)
    else if (cleaned.match(/^\-?\d+,\d{1,2}$/)) {
        cleaned = cleaned.replace(',', '.');
    }

    // Handle parentheses for negative numbers
    if (cleaned.match(/^\(.*\)$/)) {
        cleaned = '-' + cleaned.replace(/[()]/g, '');
    }

    // Handle trailing minus
    if (cleaned.match(/\d+\-$/)) {
        cleaned = '-' + cleaned.replace('-', '');
    }

    return parseFloat(cleaned);
}

// Returns { parent_category, subcategory }
function suggestCategory(description) {
    if (!description) return { parent_category: 'other', subcategory: 'Uncategorized' };

    const desc = description.toLowerCase();

    // Keywords mapped to parent > subcategory
    const keywords = {
        // Food
        'food:Groceries': ['grocery', 'supermarket', 'walmart', 'target', 'costco', 'whole foods', 'trader joe'],
        'food:Eating Out': ['restaurant', 'cafe', 'pizza', 'burger', 'mcdonalds', 'starbucks', 'subway', 'chipotle', 'dining', 'lunch', 'dinner', 'breakfast', 'bakery', 'deli'],
        'food:Coffee & Snacks': ['coffee', 'starbucks', 'dunkin', 'snack'],
        'food:Bars & Nightlife': ['bar', 'pub', 'club', 'nightclub', 'cocktail', 'brewery'],

        // Transport
        'transport:Public Transport': ['transit', 'metro', 'bus', 'train', 'subway', 'amtrak'],
        'transport:Car': ['gas', 'fuel', 'petrol', 'parking', 'automotive', 'car wash'],
        'transport:Taxi/Uber': ['uber', 'lyft', 'taxi', 'cab'],

        // Housing
        'housing:Utilities': ['electric', 'water', 'gas bill', 'internet', 'phone', 'mobile', 'utility', 'cable', 'comcast', 'verizon', 'at&t'],
        'housing:Insurance': ['insurance', 'geico', 'state farm', 'allstate'],
        'housing:Rent/Mortgage': ['rent', 'mortgage', 'landlord'],

        // Subscriptions
        'subscriptions:Streaming': ['netflix', 'spotify', 'hulu', 'disney', 'hbo', 'amazon prime', 'youtube', 'apple tv'],
        'subscriptions:Software': ['adobe', 'microsoft', 'dropbox', 'icloud', 'google storage'],
        'subscriptions:Memberships': ['gym', 'fitness', 'membership', 'planet fitness', 'equinox'],

        // Shopping
        'shopping:Clothing': ['clothing', 'fashion', 'nordstrom', 'gap', 'old navy', 'h&m', 'zara'],
        'shopping:Electronics': ['electronics', 'best buy', 'apple store', 'samsung'],
        'shopping:Home & Furniture': ['furniture', 'home depot', 'ikea', 'lowes', 'bed bath', 'wayfair'],
        'shopping:Gifts': ['gift', 'present'],

        // Entertainment
        'entertainment:Events & Tickets': ['movie', 'cinema', 'theater', 'concert', 'ticket', 'ticketmaster', 'stubhub'],
        'entertainment:Games': ['game', 'steam', 'playstation', 'xbox', 'nintendo'],

        // Health
        'health:Pharmacy': ['pharmacy', 'cvs', 'walgreens', 'medicine', 'prescription'],
        'health:Medical': ['doctor', 'hospital', 'medical', 'dental', 'clinic', 'therapy', 'dentist'],
        'health:Fitness': ['fitness', 'gym', 'yoga', 'sport'],

        // Travel
        'travel:Flights': ['airline', 'flight', 'delta', 'united', 'american airlines', 'southwest'],
        'travel:Accommodation': ['hotel', 'airbnb', 'motel', 'resort', 'hostel'],

        // Income
        'income:Salary': ['payroll', 'salary', 'wage', 'direct deposit'],
        'income:Other Income': ['refund', 'rebate', 'cashback']
    };

    for (const [key, kw] of Object.entries(keywords)) {
        if (kw.some(k => desc.includes(k))) {
            const [parent, sub] = key.split(':');
            return { parent_category: parent, subcategory: sub };
        }
    }

    return { parent_category: 'other', subcategory: 'Uncategorized' };
}

function getCategoryOptions(selectedParent, selectedSub) {
    // Get all categories from categories.js
    const categories = getCategoriesOrdered();
    let html = '';

    categories.forEach(cat => {
        // Add optgroup for each parent category
        html += `<optgroup label="${cat.icon} ${cat.name}">`;
        cat.subcategories.forEach(sub => {
            const value = `${cat.key}:${sub}`;
            const isSelected = (cat.key === selectedParent && sub === selectedSub) ? 'selected' : '';
            html += `<option value="${value}" ${isSelected}>${sub}</option>`;
        });
        html += `</optgroup>`;
    });

    return html;
}

// ============================================
// Import Actions
// ============================================
async function importSelectedTransactions() {
    const container = document.getElementById('csvTransactions');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const categorySelects = container.querySelectorAll('.category-select');

    if (checkboxes.length === 0) {
        alert('No transactions selected for import.');
        return;
    }

    let imported = 0;
    let errors = 0;
    const categoryMap = {};

    // Build category map (value is "parent:subcategory")
    categorySelects.forEach(select => {
        categoryMap[select.dataset.index] = select.value;
    });

    // Show loading state
    setLoading(true);

    for (const checkbox of checkboxes) {
        const index = parseInt(checkbox.dataset.index);
        const row = CSVImport.parsedData[index];

        if (!row) continue;

        const date = parseDate(row[CSVImport.columnMapping.date]);
        const description = row[CSVImport.columnMapping.description] || '';
        const amount = parseAmount(row[CSVImport.columnMapping.amount]);

        // Parse the category value (format: "parent:subcategory")
        const categoryValue = categoryMap[index] || 'other:Uncategorized';
        const [parent_category, subcategory] = categoryValue.split(':');

        if (!date || isNaN(amount)) continue;

        const expense = {
            description: description.substring(0, 100),
            amount: Math.abs(amount),
            parent_category: parent_category,
            subcategory: subcategory || null,
            date: date
        };

        try {
            const savedExpense = await addExpenseToDb(expense);
            App.expenses.unshift({
                id: savedExpense.id,
                ...expense
            });
            imported++;
        } catch (err) {
            console.error('Error importing expense:', err);
            errors++;
        }
    }

    setLoading(false);

    if (imported > 0) {
        renderAll();
        if (errors > 0) {
            alert(`Imported ${imported} transaction(s). ${errors} failed.`);
        } else {
            alert(`Successfully imported ${imported} transaction(s)!`);
        }
        cancelCSVImport();
    } else {
        alert('No valid transactions were imported. Check your column mapping.');
    }
}

function cancelCSVImport() {
    document.getElementById('csvPreview').classList.add('hidden');
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvTransactions').innerHTML = '';
    CSVImport.parsedData = [];
    CSVImport.headers = [];
}

// Utility already defined in app.js, but define here for safety
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
