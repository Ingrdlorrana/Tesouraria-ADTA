// Tipos para o sistema de administrativo

export type AppRole = 'admin' | 'viewer';
export type CategoryType = 'income' | 'expense';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface ChurchSettings {
  id: string;
  name: string;
  cnpj: string | null;
  address: string | null;
  phone: string | null;
  initial_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IncomeEntry {
  id: string;
  category_id: string;
  member_id: string | null;
  amount: number;
  date: string;
  description: string | null;
  campaign_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: Category;
  member?: Member;
}

export interface ExpenseEntry {
  id: string;
  category_id: string;
  amount: number;
  date: string;
  description: string | null;
  beneficiary: string | null;
  receipt_url: string | null;
  is_recurring: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: Category;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  incomeByCategory: { name: string; value: number }[];
  expensesByCategory: { name: string; value: number }[];
}

export interface MonthlyReport {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}
