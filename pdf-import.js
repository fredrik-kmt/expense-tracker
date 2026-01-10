/**
 * PDF Import Module
 * =================
 * Handles parsing and importing bank statements in PDF format
 * Uses PDF.js for parsing PDF files
 */

// PDF Import state
const PDFImport = {
    transactions: [],
    pdfjsLoaded: false
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
});

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
        const category = suggestPDFCategory(description);

        transactions.push({
            date,
            description,
            amount,
            category
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
function suggestPDFCategory(description) {
    const desc = description.toLowerCase();

    const keywords = {
        food: ['restaurant', 'cafe', 'coffee', 'grocery', 'supermarket', 'food', 'netto', 'fotex', 'rema', 'lidl', 'aldi', 'irma', 'meny', 'bilka', 'kvickly', 'pizza', 'burger', 'sushi', 'kebab', 'bakery', '7-eleven', 'circle k'],
        transport: ['uber', 'taxi', 'bus', 'train', 'dsb', 'rejsekort', 'benzin', 'parking', 'shell', 'ok', 'q8', 'circle k', 'metro', 'bil', 'tog'],
        utilities: ['electric', 'water', 'internet', 'phone', 'rent', 'insurance', 'el', 'vand', 'varme', 'husleje', 'forsikring', 'tdc', 'yousee', 'telenor', 'telia'],
        entertainment: ['netflix', 'spotify', 'hbo', 'movie', 'cinema', 'game', 'steam', 'playstation', 'biograf', 'koncert', 'ticket'],
        shopping: ['amazon', 'store', 'shop', 'h&m', 'zara', 'ikea', 'magasin', 'elgiganten', 'power', 'normal', 'flying tiger', 'jysk'],
        health: ['pharmacy', 'doctor', 'hospital', 'gym', 'fitness', 'apotek', 'tandlage', 'lage', 'fitness world', 'sats']
    };

    for (const [category, kw] of Object.entries(keywords)) {
        if (kw.some(k => desc.includes(k))) {
            return category;
        }
    }
    return 'other';
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
                        ${getPDFCategoryOptions(t.category)}
                    </select>
                </div>
            `;
        }).join('');
    }
}

function getPDFCategoryOptions(selected) {
    const categories = [
        { value: 'food', label: 'Food & Dining' },
        { value: 'transport', label: 'Transport' },
        { value: 'utilities', label: 'Utilities' },
        { value: 'entertainment', label: 'Entertainment' },
        { value: 'shopping', label: 'Shopping' },
        { value: 'health', label: 'Health' },
        { value: 'other', label: 'Other' }
    ];

    return categories.map(cat =>
        `<option value="${cat.value}" ${cat.value === selected ? 'selected' : ''}>${cat.label}</option>`
    ).join('');
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

    // Build category map
    categorySelects.forEach(select => {
        categoryMap[select.dataset.index] = select.value;
    });

    // Show loading state
    setLoading(true);

    for (const checkbox of checkboxes) {
        const index = parseInt(checkbox.dataset.index);
        const transaction = PDFImport.transactions[index];
        if (!transaction) continue;

        const category = categoryMap[index] || transaction.category;

        const expense = {
            description: transaction.description.substring(0, 100),
            amount: transaction.amount,
            category: category,
            date: transaction.date
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
