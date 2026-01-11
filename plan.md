# Expense Tracker App - Development Plan

## Project Overview
A monthly expense tracking web app built with vanilla HTML/CSS/JavaScript and Supabase for cloud sync.

**GitHub:** https://github.com/fredrik-kmt/expense-tracker  
**Live URL:** https://fredrik-kmt.github.io/expense-tracker/  
**Local Path:** `C:\Users\klant\Desktop\ClaudeTrials\ExpenseApp\`

---

## Current Tech Stack
- Frontend: Vanilla HTML, CSS, JavaScript (no frameworks)
- Backend: Supabase (PostgreSQL + Auth)
- Hosting: GitHub Pages
- PDF Parsing: PDF.js
- Currency: Danish Kroner (kr)

---

## 🎯 Iteration 2 - Feature Roadmap

Build these features IN ORDER. Each section is a complete unit of work.

---

## PHASE 1: Categories & Subcategories

### 1.1 New Category Structure

Replace the current flat categories with this hierarchical structure:

```
📁 Income
   ├── Salary
   ├── Side Income
   └── Other Income

📁 Housing
   ├── Rent/Mortgage
   ├── Utilities (electric, water, heating)
   ├── Insurance
   └── Maintenance

📁 Food
   ├── Groceries
   ├── Eating Out
   ├── Bars & Nightlife
   └── Coffee & Snacks

📁 Transport
   ├── Public Transport
   ├── Car (fuel, parking, maintenance)
   ├── Taxi/Uber
   └── Bike

📁 Subscriptions
   ├── Streaming (Netflix, Spotify, etc.)
   ├── Software
   ├── Memberships (gym, clubs)
   └── Other Subscriptions

📁 Shopping
   ├── Clothing
   ├── Electronics
   ├── Home & Furniture
   └── Gifts

📁 Health
   ├── Medical
   ├── Pharmacy
   ├── Fitness
   └── Personal Care

📁 Entertainment
   ├── Events & Tickets
   ├── Hobbies
   ├── Games
   └── Other Entertainment

📁 Travel & Vacation
   ├── Flights
   ├── Accommodation
   ├── Activities
   └── Travel Food & Transport

📁 Savings & Investments
   ├── Emergency Buffer
   ├── Stocks
   ├── ETFs/Funds
   ├── Pension
   ├── Travel Savings
   └── Other Savings

📁 Other
   └── Uncategorized
```

### 1.2 Database Changes

Update the expenses table to store parent + subcategory:

```sql
-- Modify expenses table
ALTER TABLE expenses 
ADD COLUMN parent_category TEXT,
ADD COLUMN subcategory TEXT;

-- Migrate existing data: move 'category' to 'parent_category', set subcategory to null
UPDATE expenses SET parent_category = category, subcategory = NULL;

-- Optional: remove old category column after migration
-- ALTER TABLE expenses DROP COLUMN category;
```

Create a categories table for user-defined categories:

```sql
CREATE TABLE user_categories (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    parent_category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, parent_category, subcategory)
);

-- RLS Policy
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own categories" ON user_categories
    FOR ALL USING (auth.uid() = user_id);
```

### 1.3 Category Picker UI

Replace the current `<select>` dropdown with a two-level picker:

```
┌─────────────────────────────────────┐
│ Category                            │
│ ┌─────────────────────────────────┐ │
│ │ Food > Groceries            ▼  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ When clicked, show dropdown:        │
│ ┌─────────────────────────────────┐ │
│ │ 📁 Income                       │ │
│ │    ├── Salary                   │ │
│ │    ├── Side Income              │ │
│ │    └── Other Income             │ │
│ │ 📁 Housing                      │ │
│ │    ├── Rent/Mortgage            │ │
│ │    └── ...                      │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 1.4 Money Flow: Available vs Expenses vs Savings

**Core Concept:**
- "Savings & Investments" category is tracked separately
- NOT counted as "spending" in budgets
- Shown in its own section in reports

**Summary Display:**
```
January 2026

Income:      25,000 kr  (Salary + Side Income)
Expenses:    18,500 kr  (All categories except Savings)
Savings:      4,000 kr  (Savings & Investments category)
─────────────────────────
Remaining:    2,500 kr  (Income - Expenses - Savings)
```

### 1.5 Budget Updates

- Budgets are set per PARENT category only (not subcategory)
- Savings category should NOT have a budget (it's a goal, not a limit)
- Update budget UI to use new parent categories

---

## PHASE 2: PDF Import Review Flow

### 2.1 Import Flow Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     IMPORT BANK STATEMENT                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Upload PDF                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │     📄 Drag & drop PDF here, or click to browse          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Step 2: Review & Categorize                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ☑️  12.01.2026  │  Netto Østerbro      │  -485,00 kr     │   │
│  │     [Food > Groceries                              ▼]     │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ ☑️  12.01.2026  │  Netflix             │   -89,00 kr     │   │
│  │     [Subscriptions > Streaming                     ▼]     │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ ☐   11.01.2026  │  REF#XJ7392AJ        │     0,00 kr     │   │
│  │     [Skip - unchecked                              ▼]     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Select All] [Deselect All]                                     │
│                                                                  │
│  Step 3: Import                                                  │
│  [Import 15 Selected Transactions]  [Cancel]                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Auto-Suggest Categories

Store category suggestions based on description patterns:

```sql
CREATE TABLE category_suggestions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    description_pattern TEXT NOT NULL,  -- e.g., "netto", "netflix"
    parent_category TEXT NOT NULL,
    subcategory TEXT,
    use_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, description_pattern)
);

-- RLS Policy
ALTER TABLE category_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own suggestions" ON category_suggestions
    FOR ALL USING (auth.uid() = user_id);
```

**Logic:**
1. When user categorizes "Netto" as "Food > Groceries", save pattern "netto" (lowercase)
2. Next import, if description contains "netto", auto-select "Food > Groceries"
3. Increment `use_count` each time pattern is used
4. Higher use_count = higher confidence in suggestion

### 2.3 PDF Parsing Improvements

Focus on Danish bank statement formats:
- Date formats: DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY
- Amount formats: -1.234,56 kr (negative = expense)
- Handle both semicolon and comma delimiters

---

## PHASE 3: Month Visualization & Payday

### 3.1 Payday Setting

Add user setting for payday:

```sql
CREATE TABLE user_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    payday_day INTEGER DEFAULT 25,  -- Day of month (1-31)
    starting_balance DECIMAL DEFAULT 0,  -- Current account balance
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);
```

### 3.2 Month Progress Visualization

Display at top of main view:

```
┌─────────────────────────────────────────────────────────────────┐
│  January 2026                                    ⚙️ Settings     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 ... 25 ... 31     │
│  [█][█][█][█][█][█][█][█][█][█][▓][ ][ ][ ][ ]    [💰]    [ ]    │
│                               ↑ Today             ↑ Payday       │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ 📅 14 days   │ │ 💰 8,500 kr  │ │ 📊 607 kr    │             │
│  │ until payday │ │ available    │ │ per day      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Available Balance Tracking

**How it works:**
1. User sets "Starting Balance" in settings (their current account balance)
2. As they log income: balance increases
3. As they log expenses: balance decreases
4. As they log savings transfers: balance decreases (but tracked separately)

**Calculation:**
```
Available Balance = Starting Balance 
                  + Sum(Income this month)
                  - Sum(Expenses this month)
                  - Sum(Savings this month)
```

**Or simpler approach:**
User manually updates "Current Balance" periodically, and we just show it + calculate daily budget based on days until payday.

---

## PHASE 4: UI/UX Improvements

### 4.1 Visual Refresh - Softer Color Palette

**Current (too bold):**
- Primary: #3498db (bright blue)
- Danger: #e74c3c (bright red)
- Success: #27ae60 (bright green)

**New (muted, modern):**
```css
:root {
    /* Primary */
    --primary: #6366f1;        /* Soft indigo */
    --primary-light: #818cf8;
    --primary-dark: #4f46e5;
    
    /* Neutrals */
    --bg-primary: #fafafa;     /* Off-white background */
    --bg-card: #ffffff;
    --text-primary: #1f2937;   /* Dark gray, not black */
    --text-secondary: #6b7280;
    --border: #e5e7eb;
    
    /* Accents */
    --success: #10b981;        /* Soft green */
    --warning: #f59e0b;        /* Soft amber */
    --danger: #ef4444;         /* Soft red */
    --info: #3b82f6;           /* Soft blue */
    
    /* Category colors (muted) */
    --cat-income: #10b981;
    --cat-housing: #8b5cf6;
    --cat-food: #f59e0b;
    --cat-transport: #3b82f6;
    --cat-subscriptions: #ec4899;
    --cat-shopping: #14b8a6;
    --cat-health: #ef4444;
    --cat-entertainment: #f97316;
    --cat-travel: #06b6d4;
    --cat-savings: #22c55e;
    --cat-other: #6b7280;
}
```

### 4.2 Quick Stats on Expenses Tab

Show summary cards at top of Expenses tab:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Today       │ │ This Week   │ │ This Month  │ │ Available   │
│   285 kr    │ │  2,450 kr   │ │ 12,340 kr   │ │  8,500 kr   │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

### 4.3 Reports Tab Redesign

Clean layout with clear sections:

```
┌─────────────────────────────────────────────────────────────────┐
│                        JANUARY 2026                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SUMMARY                                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Income        25,000 kr                                │    │
│  │  Expenses     -18,500 kr                                │    │
│  │  Savings       -4,000 kr                                │    │
│  │  ─────────────────────────                              │    │
│  │  Remaining      2,500 kr                                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  SPENDING BY CATEGORY                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Housing     ████████████████████░░░░░  8,000 kr (43%) │    │
│  │  Food        ████████░░░░░░░░░░░░░░░░░  3,200 kr (17%) │    │
│  │  Transport   █████░░░░░░░░░░░░░░░░░░░░  2,100 kr (11%) │    │
│  │  ...                                                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  SAVINGS THIS MONTH                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Emergency Buffer    2,000 kr                           │    │
│  │  Stocks              1,500 kr                           │    │
│  │  Travel Savings        500 kr                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE 5: Quality of Life Features

### 5.1 Edit Existing Expenses

Click on an expense to edit:

```
┌─────────────────────────────────────────────────────────────────┐
│  EDIT EXPENSE                                              [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Description:  [Netto Østerbro                            ]     │
│  Amount:       [485,00                                    ] kr  │
│  Category:     [Food > Groceries                          ▼]    │
│  Date:         [2026-01-12                                📅]   │
│                                                                  │
│  [Save Changes]                            [Delete] [Cancel]     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

Database: No changes needed, just UPDATE instead of INSERT.

### 5.2 Confirm Before Delete

Add confirmation modal:

```
┌─────────────────────────────────────────────────────────────────┐
│  DELETE EXPENSE?                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Are you sure you want to delete this expense?                   │
│                                                                  │
│  "Netto Østerbro" - 485,00 kr                                   │
│                                                                  │
│                              [Cancel]  [Delete]                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Recurring Expenses (Future Enhancement)

Mark expenses as recurring:

```sql
CREATE TABLE recurring_expenses (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    description TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    parent_category TEXT NOT NULL,
    subcategory TEXT,
    day_of_month INTEGER,  -- e.g., rent on 1st
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

At start of each month, auto-create expenses from recurring templates.

---

## PHASE 6: User-Managed Categories

### 6.1 Manage Categories Screen

New tab or modal for category management:

```
┌─────────────────────────────────────────────────────────────────┐
│  MANAGE CATEGORIES                                         [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📁 Food                                                         │
│     ├── Groceries                                               │
│     ├── Eating Out                                              │
│     ├── Bars & Nightlife                                        │
│     ├── Coffee & Snacks                                         │
│     └── [+ Add Subcategory]                                     │
│                                                                  │
│  📁 Transport                                                    │
│     ├── Public Transport                                        │
│     └── [+ Add Subcategory]                                     │
│                                                                  │
│  [+ Add New Category]                                            │
│                                                                  │
│  Note: Default categories cannot be deleted.                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Rules

- Users CAN add new parent categories
- Users CAN add new subcategories to any parent
- Users CANNOT delete or rename default categories
- Users CANNOT delete categories that have transactions (show count)

---

## PHASE 7: Dark Mode

### 7.1 Theme Toggle

Add toggle in header or settings:

```
[☀️ Light] [🌙 Dark]
```

### 7.2 Dark Mode Colors

```css
[data-theme="dark"] {
    --bg-primary: #111827;
    --bg-card: #1f2937;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border: #374151;
    
    /* Keep accent colors similar but slightly adjust */
    --primary: #818cf8;
    --success: #34d399;
    --warning: #fbbf24;
    --danger: #f87171;
}
```

### 7.3 Persistence

Save theme preference in localStorage (instant) and optionally in user_settings table (for cross-device sync).

---

## Database Schema Summary

After all phases, these tables will exist:

```sql
-- Core data
expenses (id, user_id, description, amount, parent_category, subcategory, date, created_at)
budgets (id, user_id, parent_category, amount)
monthly_income (id, user_id, month_key, amount)

-- New tables
user_categories (id, user_id, parent_category, subcategory, is_default, created_at)
category_suggestions (id, user_id, description_pattern, parent_category, subcategory, use_count, created_at)
user_settings (id, user_id, payday_day, starting_balance, theme, created_at, updated_at)
recurring_expenses (id, user_id, description, amount, parent_category, subcategory, day_of_month, is_active, created_at)
```

---

## File Structure (Updated)

```
ExpenseApp/
├── index.html           # Main HTML
├── styles.css           # All styles (including dark mode)
├── app.js               # Main app logic
├── supabase.js          # Auth & database operations
├── categories.js        # Category management (NEW)
├── csv-import.js        # CSV import
├── pdf-import.js        # PDF import with review flow
├── settings.js          # User settings (payday, theme) (NEW)
└── plan.md              # This file
```

---

## Build Order Checklist

### Phase 1: Categories & Subcategories
- [x] Create database migration for expenses table
- [x] Create user_categories table
- [x] Build hierarchical category picker component
- [x] Update expense form to use new picker
- [x] Update expense list display
- [x] Update budget form for parent categories only
- [x] Separate "Savings" from "Expenses" in calculations
- [x] Update reports to show Available/Expenses/Savings split

### Phase 2: PDF Import Review Flow
- [ ] Create category_suggestions table
- [ ] Redesign PDF import UI with review list
- [ ] Add checkbox for each transaction
- [ ] Add category dropdown (hierarchical) for each row
- [ ] Implement auto-suggest based on previous categorizations
- [ ] Add Select All / Deselect All buttons
- [ ] Save suggestions when user categorizes

### Phase 3: Month Visualization & Payday
- [ ] Create user_settings table
- [ ] Add settings modal/page
- [ ] Build payday day selector
- [ ] Build month progress bar component
- [ ] Calculate and display days until payday
- [ ] Calculate and display available balance
- [ ] Calculate and display daily budget

### Phase 4: UI/UX Improvements
- [ ] Update CSS color variables (softer palette)
- [ ] Add quick stats cards to Expenses tab
- [ ] Redesign Reports tab layout
- [ ] Improve typography and spacing throughout

### Phase 5: Quality of Life
- [ ] Add edit expense modal
- [ ] Implement update expense in database
- [ ] Add delete confirmation modal
- [ ] (Optional) Create recurring_expenses table
- [ ] (Optional) Build recurring expense management UI

### Phase 6: User-Managed Categories
- [ ] Build category management UI
- [ ] Implement add parent category
- [ ] Implement add subcategory
- [ ] Prevent deletion of default categories
- [ ] Show transaction count per category

### Phase 7: Dark Mode
- [ ] Add CSS custom properties for theming
- [ ] Create dark mode color scheme
- [ ] Add theme toggle UI
- [ ] Save preference to localStorage
- [ ] (Optional) Sync preference to user_settings

---

## Notes for Claude Code

1. **Build phases in order** - each phase depends on the previous
2. **Test each phase** before moving to the next
3. **Keep the code simple** - vanilla JS, no frameworks
4. **Match existing code style** - look at current files for patterns
5. **Update this plan.md** after completing each phase (check the boxes)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial release with basic expense tracking |
| 1.1 | Jan 2026 | Fixed auth buttons, added PDF import |
| 2.0 | TBD | Categories, Import Flow, Payday, UI Refresh |

---

Last updated: January 2026
