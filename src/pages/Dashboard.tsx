import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMonthlyTotals, useCategoryTotals, useRecentEntries } from '@/hooks/useFinancialData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import WelcomeHeader from '@/components/WelcomeHeader';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar,
  Cake,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

// Paleta de cores moderna e sofisticada para os gráficos
const CHART_COLORS = [
  '#6366F1', // Indigo vibrante
  '#10B981', // Esmeralda
  '#F59E0B', // Âmbar
  '#EC4899', // Rosa pink
  '#8B5CF6', // Roxo violeta
  '#14B8A6', // Teal
  '#F97316', // Laranja
  '#EF4444', // Vermelho
  '#06B6D4', // Ciano
  '#A855F7', // Roxo claro
  '#84CC16', // Lima
  '#F43F5E', // Rosa vermelho
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function Dashboard() {
  const currentDate = new Date();
  const { data: monthlyTotals, isLoading: loadingTotals } = useMonthlyTotals(currentDate);
  const { data: categoryTotals, isLoading: loadingCategories } = useCategoryTotals(currentDate);
  const { data: recentEntries, isLoading: loadingRecent } = useRecentEntries(8);

  // Buscar próximos eventos
  const { data: upcomingEvents, isLoading: loadingEvents } = useQuery({
    queryKey: ['dashboard-upcoming-events'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = format(futureDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('date', today)
        .lte('date', futureDateStr)
        .order('date')
        .order('time')
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  // Buscar aniversariantes do mês
  const { data: monthBirthdays, isLoading: loadingBirthdays } = useQuery({
    queryKey: ['dashboard-month-birthdays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, birth_date')
        .not('birth_date', 'is', null)
        .eq('is_active', true);

      if (error) throw error;

      const currentMonth = new Date().getMonth() + 1;
      const currentMonthBirthdays = data?.filter(member => {
        const birthDate = parseISO(member.birth_date);
        return birthDate.getMonth() + 1 === currentMonth;
      }).sort((a, b) => {
        const dateA = parseISO(a.birth_date);
        const dateB = parseISO(b.birth_date);
        return dateA.getDate() - dateB.getDate();
      });

      return currentMonthBirthdays || [];
    },
  });

  const formatEventDate = (dateStr: string, timeStr?: string) => {
    const eventDate = parseISO(dateStr);
    
    if (isToday(eventDate)) {
      return timeStr ? `Hoje às ${timeStr.slice(0, 5)}` : 'Hoje';
    }
    
    if (isTomorrow(eventDate)) {
      return timeStr ? `Amanhã às ${timeStr.slice(0, 5)}` : 'Amanhã';
    }
    
    return format(eventDate, "dd/MM 'às' ", { locale: ptBR }) + (timeStr?.slice(0, 5) || '');
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <WelcomeHeader />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Total Income */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas do Mês</CardTitle>
            <ArrowDownCircle className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            {loadingTotals ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(monthlyTotals?.totalIncome || 0)}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Receitas totais
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas do Mês</CardTitle>
            <ArrowUpCircle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            {loadingTotals ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(monthlyTotals?.totalExpenses || 0)}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  Despesas totais
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo do Mês</CardTitle>
            <Wallet className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {loadingTotals ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div
                  className={`text-2xl font-bold ${
                    (monthlyTotals?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(monthlyTotals?.balance || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Diferença entre entradas e saídas
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Income by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entradas por Categoria</CardTitle>
            <CardDescription>Distribuição das receitas do mês</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="h-48 w-48 rounded-full" />
              </div>
            ) : categoryTotals?.incomeByCategory.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhuma entrada registrada
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryTotals?.incomeByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {categoryTotals?.incomeByCategory.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saídas por Categoria</CardTitle>
            <CardDescription>Distribuição das despesas do mês</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <div className="h-64 flex items-center justify-center">
                <Skeleton className="h-48 w-48 rounded-full" />
              </div>
            ) : categoryTotals?.expensesByCategory.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhuma saída registrada
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryTotals?.expensesByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent}) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {categoryTotals?.expensesByCategory.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimos Lançamentos</CardTitle>
          <CardDescription>Movimentações mais recentes</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentEntries?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lançamento registrado
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries?.map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        entry.type === 'income'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {entry.type === 'income' ? (
                        <ArrowDownCircle className="h-4 w-4" />
                      ) : (
                        <ArrowUpCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {entry.category?.name || 'Sem categoria'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.description || 'Sem descrição'} •{' '}
                        {format(new Date(entry.date), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={entry.type === 'income' ? 'default' : 'destructive'}
                      className="font-mono"
                    >
                      {entry.type === 'income' ? '+' : '-'}
                      {formatCurrency(Number(entry.amount))}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aniversariantes e Próximos Eventos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Aniversariantes do Mês */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5 text-pink-500" />
              Aniversariantes do Mês
            </CardTitle>
            <CardDescription>Comemore com a família da igreja</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBirthdays ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : monthBirthdays?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum aniversariante este mês
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {monthBirthdays?.map((member: any) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                    <div className="bg-pink-100 dark:bg-pink-900/30 p-2 rounded-full">
                      <Cake className="h-4 w-4 text-pink-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(member.birth_date), "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos Eventos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Próximos Eventos
            </CardTitle>
            <CardDescription>Programação dos próximos dias</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : upcomingEvents?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum evento próximo
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {upcomingEvents?.map((event: any) => (
                  <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                      <Calendar className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatEventDate(event.date, event.time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
