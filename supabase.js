/**
 * Supabase Configuration and Client
 * ==================================
 */

const SUPABASE_URL = 'https://jtwigywkwncqvwliyyrw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0d2lneXdrd25jcXZ3bGl5eXJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjY0MTksImV4cCI6MjA4MzYwMjQxOX0.i390AR1FdO7UxgeARSm4nwO09ONL5FMiwL7DWWWp14g';

// Initialize Supabase client
let supabase = null;
try {
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
    } else {
        console.error('Supabase library not loaded');
    }
} catch (e) {
    console.error('Failed to initialize Supabase:', e);
}

let currentUser = null;

// ============================================
// Authentication Functions
// ============================================

async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });

    if (error) throw error;
    return data;
}

async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;
    return data;
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    currentUser = null;
}

async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// Listen for auth changes
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        console.log('Auth state changed:', event, currentUser?.email);

        if (event === 'SIGNED_IN') {
            showApp();
            loadAllData();
        } else if (event === 'SIGNED_OUT') {
            showAuth();
        }
    });
}

// ============================================
// Database Functions - Expenses
// ============================================

async function fetchExpenses() {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
}

async function addExpenseToDb(expense) {
    const { data, error } = await supabase
        .from('expenses')
        .insert({
            user_id: currentUser.id,
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            date: expense.date
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function deleteExpenseFromDb(id) {
    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// Database Functions - Budgets
// ============================================

async function fetchBudgets() {
    const { data, error } = await supabase
        .from('budgets')
        .select('*');

    if (error) throw error;

    // Convert to object format
    const budgets = {};
    (data || []).forEach(b => {
        budgets[b.category] = b.amount;
    });
    return budgets;
}

async function setBudgetInDb(category, amount) {
    const { error } = await supabase
        .from('budgets')
        .upsert({
            user_id: currentUser.id,
            category,
            amount
        }, {
            onConflict: 'user_id,category'
        });

    if (error) throw error;
}

async function deleteBudgetFromDb(category) {
    const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('category', category);

    if (error) throw error;
}

// ============================================
// Database Functions - Monthly Income
// ============================================

async function fetchMonthlyIncome() {
    const { data, error } = await supabase
        .from('monthly_income')
        .select('*');

    if (error) throw error;

    // Convert to object format
    const income = {};
    (data || []).forEach(i => {
        income[i.month_key] = i.amount;
    });
    return income;
}

async function setMonthlyIncomeInDb(monthKey, amount) {
    const { error } = await supabase
        .from('monthly_income')
        .upsert({
            user_id: currentUser.id,
            month_key: monthKey,
            amount
        }, {
            onConflict: 'user_id,month_key'
        });

    if (error) throw error;
}

async function deleteMonthlyIncomeFromDb(monthKey) {
    const { error } = await supabase
        .from('monthly_income')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('month_key', monthKey);

    if (error) throw error;
}

// ============================================
// UI State Functions
// ============================================

function showAuth() {
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
}

function showApp() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');

    // Update user display
    const userEmail = document.getElementById('userEmail');
    if (userEmail && currentUser) {
        userEmail.textContent = currentUser.email;
    }
}

function showAuthError(message) {
    const errorEl = document.getElementById('authError');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

function hideAuthError() {
    document.getElementById('authError').classList.add('hidden');
}

function setAuthLoading(loading) {
    const buttons = document.querySelectorAll('#authForm button');
    buttons.forEach(btn => {
        btn.disabled = loading;
        if (loading) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = 'Please wait...';
        } else if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
        }
    });
}
