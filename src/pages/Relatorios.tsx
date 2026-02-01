import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileBarChart,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  Heart,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function Relatorios() {
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const startDate = startOfMonth(selectedMonth);
  const endDate = endOfMonth(selectedMonth);

  // Balancete data
  const { data: balanceteData, isLoading: loadingBalancete } = useQuery({
    queryKey: ['balancete', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const [incomeResult, expenseResult] = await Promise.all([
        supabase
          .from('income_entries')
          .select(`amount, category:categories(name)`)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
        supabase
          .from('expense_entries')
          .select(`amount, category:categories(name)`)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
      ]);

      if (incomeResult.error) throw incomeResult.error;
      if (expenseResult.error) throw expenseResult.error;

      // Group by category
      const incomeByCategory: Record<string, number> = {};
      incomeResult.data.forEach((entry: any) => {
        const name = entry.category?.name || 'Outros';
        incomeByCategory[name] = (incomeByCategory[name] || 0) + Number(entry.amount);
      });

      const expensesByCategory: Record<string, number> = {};
      expenseResult.data.forEach((entry: any) => {
        const name = entry.category?.name || 'Outros';
        expensesByCategory[name] = (expensesByCategory[name] || 0) + Number(entry.amount);
      });

      const totalIncome = Object.values(incomeByCategory).reduce((a, b) => a + b, 0);
      const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);

      return {
        incomeByCategory: Object.entries(incomeByCategory).map(([name, value]) => ({
          name,
          value,
        })),
        expensesByCategory: Object.entries(expensesByCategory).map(([name, value]) => ({
          name,
          value,
        })),
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
      };
    },
  });

  // Dízimos report
  const { data: dizimosData, isLoading: loadingDizimos } = useQuery({
    queryKey: ['dizimos-report', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('income_entries')
        .select(`
          amount,
          date,
          member:members(id, name)
        `)
        .eq('category_id', (await supabase.from('categories').select('id').eq('name', 'Dízimos').single()).data?.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;

      // Group by member
      const byMember: Record<string, { name: string; total: number; count: number }> = {};
      data.forEach((entry: any) => {
        const memberId = entry.member?.id || 'anonymous';
        const memberName = entry.member?.name || 'Anônimo';
        if (!byMember[memberId]) {
          byMember[memberId] = { name: memberName, total: 0, count: 0 };
        }
        byMember[memberId].total += Number(entry.amount);
        byMember[memberId].count += 1;
      });

      const total = data.reduce((sum, entry) => sum + Number(entry.amount), 0);

      return {
        entries: data,
        byMember: Object.values(byMember).sort((a, b) => b.total - a.total),
        total,
      };
    },
  });

  // Monthly evolution
  const { data: evolutionData, isLoading: loadingEvolution } = useQuery({
    queryKey: ['monthly-evolution'],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

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

        const income = incomeResult.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
        const expenses = expenseResult.data?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

        months.push({
          month: format(date, 'MMM/yy', { locale: ptBR }),
          Entradas: income,
          Saídas: expenses,
          Saldo: income - expenses,
        });
      }

      return months;
    },
  });

  // Food action social report
  const { data: acaoSocialData, isLoading: loadingAcaoSocial } = useQuery({
    queryKey: ['acao-social-report', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const [entriesResult, exitsResult] = await Promise.all([
        supabase
          .from('food_entries')
          .select('food_name, quantity_kg, donor_name')
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
        supabase
          .from('food_exits')
          .select('food_name, quantity_kg, family_name')
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd')),
      ]);

      if (entriesResult.error) throw entriesResult.error;
      if (exitsResult.error) throw exitsResult.error;

      // Group entries by food
      const entriesByFood: Record<string, number> = {};
      entriesResult.data.forEach((entry: any) => {
        entriesByFood[entry.food_name] = (entriesByFood[entry.food_name] || 0) + Number(entry.quantity_kg);
      });

      // Group exits by food
      const exitsByFood: Record<string, number> = {};
      exitsResult.data.forEach((exit: any) => {
        exitsByFood[exit.food_name] = (exitsByFood[exit.food_name] || 0) + Number(exit.quantity_kg);
      });

      // Group exits by family
      const exitsByFamily: Record<string, number> = {};
      exitsResult.data.forEach((exit: any) => {
        const family = exit.family_name || 'Sem família';
        exitsByFamily[family] = (exitsByFamily[family] || 0) + Number(exit.quantity_kg);
      });

      const totalEntries = Object.values(entriesByFood).reduce((a, b) => a + b, 0);
      const totalExits = Object.values(exitsByFood).reduce((a, b) => a + b, 0);

      return {
        entriesByFood: Object.entries(entriesByFood).map(([name, value]) => ({
          name,
          value,
        })).sort((a, b) => b.value - a.value),
        exitsByFood: Object.entries(exitsByFood).map(([name, value]) => ({
          name,
          value,
        })).sort((a, b) => b.value - a.value),
        exitsByFamily: Object.entries(exitsByFamily).map(([name, value]) => ({
          name,
          value,
        })).sort((a, b) => b.value - a.value),
        totalEntries,
        totalExits,
        balance: totalEntries - totalExits,
      };
    },
  });

  // Food evolution
  const { data: foodEvolutionData, isLoading: loadingFoodEvolution } = useQuery({
    queryKey: ['food-evolution'],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = startOfMonth(date);
        const end = endOfMonth(date);

        const [entriesResult, exitsResult] = await Promise.all([
          supabase
            .from('food_entries')
            .select('quantity_kg')
            .gte('date', format(start, 'yyyy-MM-dd'))
            .lte('date', format(end, 'yyyy-MM-dd')),
          supabase
            .from('food_exits')
            .select('quantity_kg')
            .gte('date', format(start, 'yyyy-MM-dd'))
            .lte('date', format(end, 'yyyy-MM-dd')),
        ]);

        const entries = entriesResult.data?.reduce((sum, e) => sum + Number(e.quantity_kg), 0) || 0;
        const exits = exitsResult.data?.reduce((sum, e) => sum + Number(e.quantity_kg), 0) || 0;

        months.push({
          month: format(date, 'MMM/yy', { locale: ptBR }),
          'Entradas (kg)': entries,
          'Saídas (kg)': exits,
          'Saldo (kg)': entries - exits,
        });
      }

      return months;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileBarChart className="h-8 w-8 text-primary" />
          Relatórios
        </h1>
        <p className="text-muted-foreground">
          Análises e relatórios financeiros e de ação social
        </p>
      </div>

      {/* Month Selector */}
      <Input
        type="month"
        value={format(selectedMonth, 'yyyy-MM')}
        onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
        className="w-auto"
      />

      <Tabs defaultValue="balancete" className="space-y-4">
        <TabsList>
          <TabsTrigger value="balancete">Balancete</TabsTrigger>
          <TabsTrigger value="dizimos">Dízimos</TabsTrigger>
          <TabsTrigger value="acao-social">Ação Social</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        {/* Balancete Tab */}
        <TabsContent value="balancete" className="space-y-4">
          {loadingBalancete ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">Total Entradas</span>
                      </div>
                      <span className="text-lg font-bold text-green-600">
                        {formatCurrency(balanceteData?.totalIncome || 0)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-muted-foreground">Total Saídas</span>
                      </div>
                      <span className="text-lg font-bold text-red-600">
                        {formatCurrency(balanceteData?.totalExpenses || 0)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        <span className="text-sm text-muted-foreground">Saldo</span>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          (balanceteData?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(balanceteData?.balance || 0)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tables */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Entradas por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {balanceteData?.incomeByCategory.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Sem entradas</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceteData?.incomeByCategory.map((item) => (
                            <TableRow key={item.name}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className="text-right font-mono text-green-600">
                                {formatCurrency(item.value)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Saídas por Categoria</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {balanceteData?.expensesByCategory.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Sem saídas</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceteData?.expensesByCategory.map((item) => (
                            <TableRow key={item.name}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className="text-right font-mono text-red-600">
                                {formatCurrency(item.value)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Dízimos Tab */}
        <TabsContent value="dizimos" className="space-y-4">
          {loadingDizimos ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <>
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total de Dízimos em {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <Badge variant="default" className="text-lg">
                      {formatCurrency(dizimosData?.total || 0)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dízimos por Membro</CardTitle>
                  <CardDescription>
                    Lista de contribuintes do mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dizimosData?.byMember.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum dízimo registrado
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Membro</TableHead>
                          <TableHead className="text-center">Contribuições</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dizimosData?.byMember.map((item) => (
                          <TableRow key={item.name}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{item.count}x</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              {formatCurrency(item.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Ação Social Tab */}
        <TabsContent value="acao-social" className="space-y-4">
          {loadingAcaoSocial ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">Total Entradas</span>
                      </div>
                      <span className="text-lg font-bold text-green-600">
                        {acaoSocialData?.totalEntries.toFixed(1)} kg
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="h-5 w-5 text-orange-500" />
                        <span className="text-sm text-muted-foreground">Total Saídas</span>
                      </div>
                      <span className="text-lg font-bold text-orange-600">
                        {acaoSocialData?.totalExits.toFixed(1)} kg
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-muted-foreground">Saldo</span>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          (acaoSocialData?.balance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {acaoSocialData?.balance.toFixed(1)} kg
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Tables */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Entradas por Alimento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {acaoSocialData?.entriesByFood.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Sem entradas</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Alimento</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {acaoSocialData?.entriesByFood.map((item) => (
                            <TableRow key={item.name}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className="text-right font-mono text-green-600">
                                {item.value.toFixed(1)} kg
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Saídas por Alimento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {acaoSocialData?.exitsByFood.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">Sem saídas</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Alimento</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {acaoSocialData?.exitsByFood.map((item) => (
                            <TableRow key={item.name}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className="text-right font-mono text-orange-600">
                                {item.value.toFixed(1)} kg
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Families distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Distribuição por Família</CardTitle>
                  <CardDescription>
                    Quantidade total recebida por cada família no mês
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {acaoSocialData?.exitsByFamily.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma distribuição registrada
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Família</TableHead>
                          <TableHead className="text-right">Total Recebido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {acaoSocialData?.exitsByFamily.map((item) => (
                          <TableRow key={item.name}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right font-mono text-blue-600">
                              {item.value.toFixed(1)} kg
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Food Evolution Chart */}
              {!loadingFoodEvolution && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Evolução de Alimentos (kg)</CardTitle>
                    <CardDescription>
                      Comparativo de entradas e saídas dos últimos 6 meses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={foodEvolutionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="Entradas (kg)"
                          stroke="#22c55e"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="Saídas (kg)"
                          stroke="#f97316"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="Saldo (kg)"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Evolução Tab */}
        <TabsContent value="evolucao" className="space-y-4">
          {loadingEvolution ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Evolução Mensal (Financeiro)</CardTitle>
                  <CardDescription>
                    Comparativo de entradas e saídas dos últimos 6 meses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Entradas"
                        stroke="#22c55e"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="Saídas"
                        stroke="#ef4444"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="Saldo"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Comparativo por Mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="Entradas" fill="#22c55e" />
                      <Bar dataKey="Saídas" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
