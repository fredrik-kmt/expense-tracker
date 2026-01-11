/**
 * PDF Import Module
 * =================
 * Handles parsing and importing bank statements in PDF format
 * Uses PDF.js for parsing PDF files
 */

// PDF Import state
const PDFImport = {
    transactions: [],
    pdfjsLoaded: false,
    suggestions: [] // Loaded from Supabase
};

// Load PDF.js from CDN if not already loaded
function loadPDFJS() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            resolve(window.pdfjsLib);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            PDFImport.pdfjsLoaded = true;
            resolve(window.pdfjsLib);
        };
        script.onerror = () => reject(new Error('Failed to load PDF.js'));
        document.head.appendChild(script);
    });
}

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initPDFImport();
    // Load suggestions if user is signed in
    if (typeof fetchCategorySuggestions === 'function') {
        // Wait for auth to be ready
        setTimeout(loadSuggestions, 1000);
    }
});

async function loadSuggestions() {
    try {
        if (currentUser) {
            PDFImport.suggestions = await fetchCategorySuggestions();
            console.log('Loaded category suggestions:', PDFImport.suggestions.length);
        }
    } catch (err) {
        console.error('Failed to load suggestions:', err);
    }
}

function initPDFImport() {
    const dropZone = document.getElementById('pdfDropZone');
    const fileInput = document.getElementById('pdfFileInput');
    const importBtn = document.getElementById('importPdfBtn');
    const cancelBtn = document.getElementById('cancelPdfBtn');

    if (!dropZone || !fileInput) {
        console.log('PDF import elements not found');
        return;
    }

    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handlePDFFile(e.target.files[0]);
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
        if (files.length > 0 && files[0].name.toLowerCase().endsWith('.pdf')) {
            handlePDFFile(files[0]);
        } else {
            alert('Please drop a PDF file.');
        }
    });

    // Import/Cancel buttons
    if (importBtn) {
        importBtn.addEventListener('click', importPDFSelectedTransactions);
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelPDFImport);
    }
}

// ============================================
// File Handling
// ============================================
async function handlePDFFile(file) {
    const dropZone = document.getElementById('pdfDropZone');

    try {
        // Show loading state
        if (dropZone) {
            dropZone.innerHTML = '<p>Loading PDF.js library...</p>';
        }

        // Load PDF.js
        const pdfjsLib = await loadPDFJS();

        if (dropZone) {
            dropZone.innerHTML = '<p>Extracting text from PDF...</p>';
        }

        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Extract text from all pages
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }

        console.log('Extracted PDF text:', fullText.substring(0, 500) + '...');

        // Parse transactions from text
        PDFImport.transactions = extractTransactionsFromText(fullText);

        if (PDFImport.transactions.length === 0) {
            alert('No transactions could be extracted from this PDF. The format may not be supported. Try exporting as CSV from your bank instead.');
            resetPDFDropzone();
            return;
        }

        // Show preview
        showPDFPreview();

    } catch (error) {
        console.error('Error reading PDF:', error);
        alert('Error reading PDF file: ' + error.message);
        resetPDFDropzone();
    }
}

// Reset PDF dropzone to original state
function resetPDFDropzone() {
    const dropZone = document.getElementById('pdfDropZone');
    if (dropZone) {
        dropZone.innerHTML = `
            <div class="upload-icon">&#128462;</div>
            <p>Drag & drop your PDF file here, or click to browse</p>
        `;
    }
}

// ============================================
// Transaction Extraction
// ============================================
function extractTransactionsFromText(text) {
    const transactions = [];

    // Split into lines and process
    const lines = text.split(/\n|\r/).filter(line => line.trim());

    // Date patterns
    const datePatterns = [
        /(\d{2}[.\-/]\d{2}[.\-/]\d{4})/,  // DD.MM.YYYY or DD-MM-YYYY
        /(\d{4}[.\-/]\d{2}[.\-/]\d{2})/,  // YYYY-MM-DD
        /(\d{2}[.\-/]\d{2}[.\-/]\d{2})/   // DD.MM.YY
    ];

    // Amount pattern (handles both formats)
    const amountPattern = /[-]?\s*[\d.,]+\s*(?:kr|DKK)?/g;

    for (const line of lines) {
        // Try to find a date in the line
        let dateMatch = null;
        for (const pattern of datePatterns) {
            dateMatch = line.match(pattern);
            if (dateMatch) break;
        }

        if (!dateMatch) continue;

        // Try to find amounts in the line
        const amounts = line.match(amountPattern) || [];
        const validAmounts = amounts
            .map(a => {
                const cleaned = a.replace(/[^0-9,.\-]/g, '');
                return parsePDFAmount(cleaned);
            })
            .filter(a => a > 0 && a < 1000000); // Filter reasonable amounts

        if (validAmounts.length === 0) continue;

        // Extract description (text between date and amount)
        const dateIndex = line.indexOf(dateMatch[0]);
        let description = line.substring(dateIndex + dateMatch[0].length).trim();

        // Remove the amount from description
        amounts.forEach(amt => {
            description = description.replace(amt, '').trim();
        });

        // Clean up description
        description = description.replace(/\s+/g, ' ').trim();

        if (description.length < 2) continue;

        // Parse date
        const date = parsePDFDate(dateMatch[0]);
        if (!date) continue;

        // Use the first valid amount
        const amount = validAmounts[0];

        // Suggest category
        const categoryInfo = suggestPDFCategory(description);

        transactions.push({
            date,
            description,
            amount,
            parent_category: categoryInfo.parent_category,
            subcategory: categoryInfo.subcategory
        });
    }

    // Remove duplicates (same date, description, amount)
    const unique = [];
    const seen = new Set();

    for (const t of transactions) {
        const key = `${t.date}-${t.description}-${t.amount}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(t);
        }
    }

    return unique;
}

// Parse amount from PDF text
function parsePDFAmount(value) {
    if (!value) return 0;

    let cleaned = value.toString().replace(/[^0-9,.\-]/g, '');

    if (cleaned.includes(',') && cleaned.includes('.')) {
        if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (cleaned.includes(',')) {
        const parts = cleaned.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            cleaned = cleaned.replace(',', '.');
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    }

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : Math.abs(amount);
}

// Parse date from PDF text
function parsePDFDate(value) {
    if (!value) return null;

    const str = value.toString().trim();

    // ISO format: 2024-01-15
    let match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }

    // European/Danish format: 15-01-2024 or 15.01.2024
    match = str.match(/^(\d{2})[-./](\d{2})[-./](\d{4})$/);
    if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
    }

    // Short year: 15.01.24
    match = str.match(/^(\d{2})[-./](\d{2})[-./](\d{2})$/);
    if (match) {
        const year = parseInt(match[3]) > 50 ? '19' + match[3] : '20' + match[3];
        return `${year}-${match[2]}-${match[1]}`;
    }

    return null;
}

// Suggest category based on description
// Returns { parent_category, subcategory }
function suggestPDFCategory(description) {
    const desc = description.toLowerCase();

    // 1. Check dynamic suggestions from database
    if (PDFImport.suggestions && PDFImport.suggestions.length > 0) {
        // Sort suggestions by pattern length (descending) to match specific patterns first
        const sorted = [...PDFImport.suggestions].sort((a, b) =>
            b.description_pattern.length - a.description_pattern.length
        );

        for (const s of sorted) {
            if (desc.includes(s.description_pattern.toLowerCase())) {
                return {
                    parent_category: s.parent_category,
                    subcategory: s.subcategory
                };
            }
        }
    }

    // 2. Fallback to hardcoded keywords
    // Keywords mapped to parent > subcategory
    const keywords = {
        // Food
        'food:Groceries': ['grocery', 'supermarket', 'netto', 'fotex', 'rema', 'lidl', 'aldi', 'irma', 'meny', 'bilka', 'kvickly'],
        'food:Eating Out': ['restaurant', 'cafe', 'pizza', 'burger', 'sushi', 'kebab', 'bakery', 'mcdonalds', 'burger king', 'subway', 'spisested'],
        'food:Coffee & Snacks': ['coffee', 'starbucks', '7-eleven', 'circle k', 'espresso'],
        'food:Bars & Nightlife': ['bar', 'pub', 'club', 'nightlife', 'cocktail'],

        // Transport
        'transport:Public Transport': ['bus', 'train', 'dsb', 'rejsekort', 'metro', 'tog', 's-tog'],
        'transport:Car': ['benzin', 'parking', 'shell', 'ok', 'q8', 'parkering', 'bil'],
        'transport:Taxi/Uber': ['uber', 'taxi', 'bolt', 'lyft'],

        // Housing
        'housing:Utilities': ['electric', 'water', 'internet', 'phone', 'el', 'vand', 'varme', 'tdc', 'yousee', 'telenor', 'telia'],
        'housing:Rent/Mortgage': ['rent', 'husleje', 'mortgage', 'bolig'],
        'housing:Insurance': ['insurance', 'forsikring'],

        // Subscriptions
        'subscriptions:Streaming': ['netflix', 'spotify', 'hbo', 'disney', 'youtube', 'apple music', 'viaplay'],
        'subscriptions:Software': ['adobe', 'microsoft', 'dropbox', 'icloud'],
        'subscriptions:Memberships': ['gym', 'fitness world', 'sats', 'medlemskab'],

        // Shopping
        'shopping:Clothing': ['h&m', 'zara', 'uniqlo', 'cos', 'weekday', 'only', 'vero moda'],
        'shopping:Electronics': ['elgiganten', 'power', 'apple', 'samsung', 'electronic'],
        'shopping:Home & Furniture': ['ikea', 'jysk', 'normal', 'flying tiger', 'sostren grene'],

        // Entertainment
        'entertainment:Events & Tickets': ['ticket', 'biograf', 'koncert', 'movie', 'cinema', 'billetto'],
        'entertainment:Games': ['steam', 'playstation', 'xbox', 'nintendo', 'game'],

        // Health
        'health:Pharmacy': ['pharmacy', 'apotek', 'medicin', 'medicine'],
        'health:Medical': ['doctor', 'hospital', 'lage', 'tandlage', 'clinic'],
        'health:Fitness': ['fitness', 'gym', 'sport', 'yoga']
    };

    for (const [key, kw] of Object.entries(keywords)) {
        if (kw.some(k => desc.includes(k))) {
            const [parent, sub] = key.split(':');
            return { parent_category: parent, subcategory: sub };
        }
    }

    return { parent_category: 'other', subcategory: 'Uncategorized' };
}

// ============================================
// Preview
// ============================================
function showPDFPreview() {
    const preview = document.getElementById('pdfPreview');
    const container = document.getElementById('pdfTransactions');

    if (preview) {
        preview.classList.remove('hidden');
    }

    resetPDFDropzone();

    if (container) {
        container.innerHTML = PDFImport.transactions.map((t, index) => {
            const categoryValue = `${t.parent_category}:${t.subcategory || ''}`;
            return `
                <div class="csv-transaction" data-index="${index}">
                    <input type="checkbox" checked data-index="${index}">
                    <div class="info">
                        <div class="desc">${escapeHtmlPDF(t.description.substring(0, 50))}${t.description.length > 50 ? '...' : ''}</div>
                        <div class="date">${t.date}</div>
                    </div>
                    <div class="amount" style="color: #e74c3c">
                        -${formatCurrency(t.amount)}
                    </div>
                    <select class="category-select" data-index="${index}">
                        ${getPDFCategoryOptions(t.parent_category, t.subcategory)}
                    </select>
                </div>
            `;
        }).join('');
    }
}

function getPDFCategoryOptions(selectedParent, selectedSub) {
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
async function importPDFSelectedTransactions() {
    const container = document.getElementById('pdfTransactions');
    if (!container) return;

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
        const transaction = PDFImport.transactions[index];
        if (!transaction) continue;

        // Parse the category value (format: "parent:subcategory")
        const categoryValue = categoryMap[index] || `${transaction.parent_category}:${transaction.subcategory || ''}`;
        const [parent_category, subcategory] = categoryValue.split(':');

        const expense = {
            description: transaction.description.substring(0, 100),
            amount: transaction.amount,
            parent_category: parent_category,
            subcategory: subcategory || null,
            date: transaction.date
        };

        try {
            const savedExpense = await addExpenseToDb(expense);
            App.expenses.unshift({
                id: savedExpense.id,
                ...expense
            });

            // Save category suggestion (learn from this import)
            if (parent_category && parent_category !== 'other') {
                const pattern = expense.description; // Use exact description as pattern
                // Or maybe clean it further? For now, exact description is safe.
                try {
                    await saveCategorySuggestion(pattern, parent_category, subcategory);
                } catch (e) {
                    console.warn('Failed to save suggestion:', e);
                    // Don't fail the import just because suggestion save failed
                }
            }

            imported++;
        } catch (err) {
            console.error('Error importing expense:', err);
            errors++;
        }
    }

    // Reload suggestions to include the newly learned ones
    await loadSuggestions();

    setLoading(false);

    // Reset and refresh
    cancelPDFImport();
    renderAll();

    if (errors > 0) {
        alert(`Imported ${imported} transactions. ${errors} failed.`);
    } else {
        alert(`Successfully imported ${imported} transactions from PDF!`);
    }
}

function cancelPDFImport() {
    PDFImport.transactions = [];

    const preview = document.getElementById('pdfPreview');
    const fileInput = document.getElementById('pdfFileInput');
    const container = document.getElementById('pdfTransactions');

    if (preview) preview.classList.add('hidden');
    if (fileInput) fileInput.value = '';
    if (container) container.innerHTML = '';

    resetPDFDropzone();
}

// Utility function
function escapeHtmlPDF(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
