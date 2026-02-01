import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export function useIncomeEntries(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['income-entries', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('income_entries')
        .select(`
          *,
          category:categories(*),
          member:members(*)
        `)
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        query = query.lte('date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useExpenseEntries(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['expense-entries', startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('expense_entries')
        .select(`
          *,
          category:categories(*)
        `)
        .order('date', { ascending: false });

      if (startDate) {
        query = query.gte('date', format(startDate, 'yyyy-MM-dd'));
      }
      if (endDate) {
        query = query.lte('date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCategories(type?: 'income' | 'expense') {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: async () => {
      let query = supabase.from('categories').select('*').order('name');

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
}

export function useChurchSettings() {
  return useQuery({
    queryKey: ['church-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('church_settings')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useMonthlyTotals(date: Date = new Date()) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);

  return useQuery({
    queryKey: ['monthly-totals', format(date, 'yyyy-MM')],
    queryFn: async () => {
      const [incomeResult, expenseResult] = await Promise.all([
        supabase
          .from('income_entries')
          .select('amount')
          .gte('date', format(start, 'yyyy-MM-dd'))
          .lte('date', format(end, 'yyyy-MM-dd')),
        supabase
          .from('expense_entries')
          .select('amount')
          .gte('date', format(start, 'yyyy-MM-dd'))
          .lte('date', format(end, 'yyyy-MM-dd')),
      ]);

      if (incomeResult.error) throw incomeResult.error;
      if (expenseResult.error) throw expenseResult.error;

      const totalIncome = incomeResult.data.reduce((sum, entry) => sum + Number(entry.amount), 0);
      const totalExpenses = expenseResult.data.reduce((sum, entry) => sum + Number(entry.amount), 0);

      return {
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
      };
    },
  });
}

export function useCategoryTotals(date: Date = new Date()) {
  const start = startOfMonth(date);
  const end = endOfMonth(date);

  return useQuery({
    queryKey: ['category-totals', format(date, 'yyyy-MM')],
    queryFn: async () => {
      const [incomeResult, expenseResult] = await Promise.all([
        supabase
          .from('income_entries')
          .select(`
            amount,
            category:categories(name)
          `)
          .gte('date', format(start, 'yyyy-MM-dd'))
          .lte('date', format(end, 'yyyy-MM-dd')),
        supabase
          .from('expense_entries')
          .select(`
            amount,
            category:categories(name)
          `)
          .gte('date', format(start, 'yyyy-MM-dd'))
          .lte('date', format(end, 'yyyy-MM-dd')),
      ]);

      if (incomeResult.error) throw incomeResult.error;
      if (expenseResult.error) throw expenseResult.error;

      // Group by category
      const incomeByCategory: Record<string, number> = {};
      incomeResult.data.forEach((entry: any) => {
        const categoryName = entry.category?.name || 'Outros';
        incomeByCategory[categoryName] = (incomeByCategory[categoryName] || 0) + Number(entry.amount);
      });

      const expensesByCategory: Record<string, number> = {};
      expenseResult.data.forEach((entry: any) => {
        const categoryName = entry.category?.name || 'Outros';
        expensesByCategory[categoryName] = (expensesByCategory[categoryName] || 0) + Number(entry.amount);
      });

      return {
        incomeByCategory: Object.entries(incomeByCategory).map(([name, value]) => ({ name, value })),
        expensesByCategory: Object.entries(expensesByCategory).map(([name, value]) => ({ name, value })),
      };
    },
  });
}

export function useRecentEntries(limit: number = 10) {
  return useQuery({
    queryKey: ['recent-entries', limit],
    queryFn: async () => {
      const [incomeResult, expenseResult] = await Promise.all([
        supabase
          .from('income_entries')
          .select(`
            *,
            category:categories(name)
          `)
          .order('date', { ascending: false })
          .limit(limit),
        supabase
          .from('expense_entries')
          .select(`
            *,
            category:categories(name)
          `)
          .order('date', { ascending: false })
          .limit(limit),
      ]);

      if (incomeResult.error) throw incomeResult.error;
      if (expenseResult.error) throw expenseResult.error;

      // Combine and sort
      const combined = [
        ...incomeResult.data.map((e: any) => ({ ...e, type: 'income' as const })),
        ...expenseResult.data.map((e: any) => ({ ...e, type: 'expense' as const })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return combined.slice(0, limit);
    },
  });
}
