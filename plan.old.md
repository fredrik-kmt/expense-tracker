# Expense Tracker App - Project Context

## Project Overview
A monthly expense tracking web app built with vanilla HTML/CSS/JavaScript and Supabase for cloud sync.

**Location:** `C:\Users\klant\Desktop\ClaudeTrials\ExpenseApp\`

**GitHub:** https://github.com/fredrik-kmt/expense-tracker
**Live URL:** https://fredrik-kmt.github.io/expense-tracker/

---

## 🔧 Recent Fixes (January 2026)

### Fixed: Non-responsive Login Buttons
**Problem:** Sign In and Create Account buttons were not responding to clicks.

**Root Cause:** Event listeners were not being properly attached to auth buttons. The code was likely running before DOM was ready, or button IDs didn't match between HTML and JavaScript.

**Solution:**
1. Ensured `DOMContentLoaded` event is properly handled
2. Added console logging to debug button attachment
3. Verified button IDs match exactly: `sign-in-btn`, `sign-up-btn`, `sign-out-btn`
4. Added proper error display element (`auth-error`)
5. Added loading states on buttons during auth operations

### Added: PDF Import
**Feature:** Users can now upload PDF bank statements in addition to CSV files.
- Uses PDF.js library for text extraction
- Attempts to parse common bank statement formats
- Supports Danish date and amount formats

---

## Tech Stack
- Frontend: Vanilla HTML, CSS, JavaScript (no frameworks)
- Backend: Supabase (PostgreSQL database + authentication)
- Hosting: GitHub Pages
- PDF Parsing: PDF.js (loaded from CDN)
- Currency: Danish Kroner (kr) with da-DK locale
- Language: English

## File Structure
```
ExpenseApp/
├── index.html      # Main HTML with auth screen + app UI
├── styles.css      # All styling including auth, forms, charts
├── app.js          # Main application logic, UI rendering
├── supabase.js     # Supabase client, auth functions, database operations
├── csv-import.js   # CSV bank statement import functionality
├── pdf-import.js   # PDF bank statement import functionality (NEW)
└── claude.md       # This file - project context for Claude
```

## Supabase Configuration
- **URL:** https://jtwigywkwncqvwliyyrw.supabase.co
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0d2lneXdrd25jcXZ3bGl5eXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjY0MTksImV4cCI6MjA4MzYwMjQxOX0.i390AR1FdO7UxgeARSm4nwO09ONL5FMiwL7DWWWp14g

### Database Tables (with Row Level Security enabled)
```sql
-- Expenses table
CREATE TABLE expenses (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    description TEXT,
    amount DECIMAL,
    category TEXT,
    date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Budgets table
CREATE TABLE budgets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    category TEXT,
    amount DECIMAL,
    UNIQUE(user_id, category)
);

-- Monthly income table
CREATE TABLE monthly_income (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    month_key TEXT,  -- Format: "YYYY-MM"
    amount DECIMAL,
    UNIQUE(user_id, month_key)
);
```

### RLS Policies (already applied)
Each table has policies for SELECT, INSERT, UPDATE, DELETE that check `auth.uid() = user_id`

---

## App Features

### Implemented ✅
1. **Authentication**
   - Email/password sign up and sign in
   - Session persistence across browser sessions
   - Sign out functionality
   - Error messages displayed in UI

2. **Expense Tracking**
   - Add expenses with description, amount, category, date
   - Delete expenses
   - View expenses filtered by month

3. **Categories**
   - Food & Dining, Transport, Utilities, Entertainment, Shopping, Health, Other
   - Each has a color for charts
   - Auto-suggestion based on description keywords

4. **Monthly Budgets**
   - Set budget limits per category
   - Visual progress bars showing spent vs limit
   - Color coding: green (ok), yellow (>80%), red (over budget)

5. **Monthly Income**
   - Set net income per month
   - Shows savings/overspent amount
   - Income vs Expenses comparison bar

6. **Reports**
   - Summary cards: Income, Spent, Savings, Budget Remaining
   - Category spending bar chart
   - Income vs Expenses visual comparison

7. **History**
   - Year selector
   - Monthly grid showing spending per month
   - Trend chart showing spending over 12 months
   - Click to jump to any month

8. **Data Management**
   - Export all data as JSON backup
   - Import JSON backup
   - Clear all data (with confirmation)

9. **CSV Import**
   - Drag & drop or click to upload CSV
   - Auto-detects date, description, amount columns
   - Preview transactions before import
   - Auto-suggests categories based on description keywords
   - Supports Danish bank formats (semicolon delimiter, comma decimals)

10. **PDF Import** (NEW)
    - Drag & drop or click to upload PDF
    - Text extraction using PDF.js
    - Pattern matching for common bank statement formats
    - Preview and category selection before import

11. **Cloud Sync**
    - Data syncs to Supabase when logged in
    - Works across devices with same account
    - Sync status indicator

---

## Testing Checklist

### Authentication Flow
- [ ] Sign up with email/password
- [ ] Check email for confirmation link (may be in spam)
- [ ] Click confirmation link
- [ ] Sign in with verified email
- [ ] Verify session persists on page refresh
- [ ] Sign out and verify redirect to auth screen

### Data Operations
- [ ] Add expense and verify it appears in list
- [ ] Delete expense
- [ ] Set budget for a category
- [ ] Set monthly income
- [ ] Navigate between months
- [ ] Import CSV file
- [ ] Import PDF file
- [ ] Export data as JSON
- [ ] Clear all data

### Cross-Device Sync
- [ ] Sign in on device A, add expense
- [ ] Sign in on device B, verify expense appears

---

## Working with Claude Code

### Recommended Workflow

1. **Always include this file** when starting a Claude Code session:
   ```
   @claude.md
   ```
   This gives Claude full context about the project.

2. **For specific file changes**, reference the file:
   ```
   @app.js Please add a feature to...
   ```

3. **After Claude makes changes**, review and test:
   - Push to GitHub: `git add . && git commit -m "message" && git push`
   - Wait ~1 minute for GitHub Pages to update
   - Test the live site

### Common Commands
```bash
# Navigate to project
cd C:\Users\klant\Desktop\ClaudeTrials\ExpenseApp

# Check git status
git status

# Stage all changes
git add .

# Commit with message
git commit -m "Fix: login button event listeners"

# Push to GitHub (deploys to Pages)
git push origin master

# Pull latest changes
git pull origin master
```

### Debugging Tips
1. **Open browser DevTools** (F12) → Console tab to see errors
2. **Check Network tab** to verify Supabase requests
3. **Look for console.log messages** that trace execution flow

---

## Known Issues & Solutions

### "Supabase library not loaded"
- Check internet connection
- CDN might be blocked - try different network
- Clear browser cache

### Auth buttons not responding
- Check browser console for errors
- Verify button IDs match in HTML and JS
- Ensure scripts load in correct order: supabase.js → app.js → csv-import.js → pdf-import.js

### "Permission denied" on database operations
- User might not be authenticated
- Email might not be verified
- Check RLS policies in Supabase dashboard

### Data not syncing
- Check if user is signed in (email should show in header)
- Check browser console for errors
- Verify Supabase project is active (not paused)

### PDF import not finding transactions
- PDF format may not be supported
- Try CSV export from bank instead
- Check console for extracted text

---

## Future Enhancements

### High Priority
- [ ] Better PDF parsing for more bank formats
- [ ] Recurring expenses (auto-add monthly bills)
- [ ] PWA support (installable app)

### Medium Priority
- [ ] Offline support with sync when online
- [ ] Multiple currencies for travel
- [ ] Better category suggestions (ML-based)
- [ ] More chart types

### Low Priority
- [ ] Dark mode
- [ ] Receipt photo upload
- [ ] Multi-user/family accounts

---

## Code Architecture

### supabase.js
Handles all authentication and database operations:
- `initSupabase()` - Create Supabase client
- `signUp()`, `signIn()`, `signOut()` - Authentication
- `getSession()` - Check current session
- `fetchExpenses()`, `addExpenseToDb()`, `deleteExpenseFromDb()` - Expense CRUD
- `fetchBudgets()`, `setBudgetInDb()`, `deleteBudgetFromDb()` - Budget CRUD
- `fetchMonthlyIncome()`, `setMonthlyIncomeInDb()`, `deleteMonthlyIncomeFromDb()` - Income CRUD
- `showAuth()`, `showApp()` - Toggle between auth and app views
- `setupAuthListeners()` - Attach event handlers to auth buttons
- `checkAuthAndInit()` - Main initialization function

### app.js
Handles UI and local state:
- `initApp()` - Initialize app UI
- `loadAllData()` - Fetch all data from Supabase
- `addExpense()`, `deleteExpense()` - Expense operations
- `setBudget()`, `deleteBudget()` - Budget operations
- `saveMonthlyIncome()`, `deleteMonthlyIncomeHandler()` - Income operations
- `renderExpenses()`, `renderBudgets()`, `renderReports()`, `renderHistory()` - UI rendering
- `switchTab()` - Tab navigation
- `changeMonth()` - Month navigation
- `exportData()`, `importData()`, `clearAllData()` - Data management

### csv-import.js
CSV file handling:
- `parseCSV()` - Parse CSV content
- `autoDetectColumns()` - Guess column mapping
- `suggestCategory()` - Keyword-based category suggestion
- `parseAmount()` - Handle different number formats
- `parseDate()` - Handle different date formats
- `importSelectedTransactions()` - Add selected rows to expenses

### pdf-import.js
PDF file handling:
- `loadPDFJS()` - Load PDF.js library from CDN
- `handlePDFFile()` - Process uploaded PDF
- `extractTransactionsFromText()` - Parse transactions from PDF text
- `importPDFSelectedTransactions()` - Import selected transactions

---

## Script Load Order (Important!)
```html
<!-- Must load in this order -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase.js"></script>
<script src="app.js"></script>
<script src="csv-import.js"></script>
<script src="pdf-import.js"></script>
```

---

## Contact & Support
For issues with this project, check:
1. Browser console for errors
2. Network tab for failed requests
3. Supabase dashboard for database issues

Last updated: January 2026
