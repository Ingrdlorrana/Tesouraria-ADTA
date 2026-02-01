import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Heart, Package, Users, Loader2, ArrowDownCircle, ArrowUpCircle, Download } from 'lucide-react';

export default function AcaoSocial() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  const [selectedTab, setSelectedTab] = useState('estoque');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'entrada' | 'saida' | 'familia'>('entrada');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Form state for food entries/exits
  const [foodFormData, setFoodFormData] = useState({
    food_name: '',
    quantity_kg: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    donor_name: '',
    family_name: '',
    description: '',
  });

  // Form state for families
  const [familyFormData, setFamilyFormData] = useState({
    family_name: '',
    responsible_name: '',
    phone: '',
    address: '',
    members_count: '',
    notes: '',
  });

  const startDate = startOfMonth(selectedMonth);
  const endDate = endOfMonth(selectedMonth);

  // Fetch food inventory
  const { data: inventory, isLoading: loadingInventory } = useQuery({
    queryKey: ['food-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_inventory')
        .select('*')
        .order('food_name');

      if (error) throw error;
      return data;
    },
  });

  // Fetch food entries (donations)
  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ['food-entries', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch food exits (distributions)
  const { data: exits, isLoading: loadingExits } = useQuery({
    queryKey: ['food-exits', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_exits')
        .select('*')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch beneficiary families
  const { data: families, isLoading: loadingFamilies } = useQuery({
    queryKey: ['beneficiary-families'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficiary_families')
        .select('*')
        .order('family_name');

      if (error) throw error;
      return data;
    },
  });

  // Save food entry mutation
  const saveFoodEntryMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) {
        const { error } = await supabase
          .from('food_entries')
          .update(data)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('food_entries')
          .insert({ ...data, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-entries'] });
      queryClient.invalidateQueries({ queryKey: ['food-inventory'] });
      toast.success(editingItem ? 'Entrada atualizada!' : 'Entrada registrada!');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  // Save food exit mutation
  const saveFoodExitMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) {
        const { error } = await supabase
          .from('food_exits')
          .update(data)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('food_exits')
          .insert({ ...data, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-exits'] });
      queryClient.invalidateQueries({ queryKey: ['food-inventory'] });
      toast.success(editingItem ? 'Saída atualizada!' : 'Saída registrada!');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  // Save family mutation
  const saveFamilyMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) {
        const { error } = await supabase
          .from('beneficiary_families')
          .update(data)
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('beneficiary_families').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiary-families'] });
      toast.success(editingItem ? 'Família atualizada!' : 'Família cadastrada!');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  // Delete mutations
  const deleteFoodEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('food_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-entries'] });
      queryClient.invalidateQueries({ queryKey: ['food-inventory'] });
      toast.success('Entrada excluída!');
    },
  });

  const deleteFoodExitMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('food_exits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food-exits'] });
      queryClient.invalidateQueries({ queryKey: ['food-inventory'] });
      toast.success('Saída excluída!');
    },
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('beneficiary_families').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiary-families'] });
      toast.success('Família removida!');
    },
  });

  function openDialog(type: 'entrada' | 'saida' | 'familia') {
    setDialogType(type);
    setEditingItem(null);
    
    if (type === 'familia') {
      setFamilyFormData({
        family_name: '',
        responsible_name: '',
        phone: '',
        address: '',
        members_count: '',
        notes: '',
      });
    } else {
      setFoodFormData({
        food_name: '',
        quantity_kg: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        donor_name: '',
        family_name: '',
        description: '',
      });
    }
    
    setIsDialogOpen(true);
  }

  function openEditDialog(item: any, type: 'entrada' | 'saida' | 'familia') {
    setDialogType(type);
    setEditingItem(item);
    
    if (type === 'familia') {
      setFamilyFormData({
        family_name: item.family_name,
        responsible_name: item.responsible_name || '',
        phone: item.phone || '',
        address: item.address || '',
        members_count: String(item.members_count || ''),
        notes: item.notes || '',
      });
    } else {
      setFoodFormData({
        food_name: item.food_name,
        quantity_kg: String(item.quantity_kg),
        date: item.date,
        donor_name: item.donor_name || '',
        family_name: item.family_name || '',
        description: item.description || '',
      });
    }
    
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingItem(null);
  }

  function handleFoodSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    const data = {
      food_name: foodFormData.food_name,
      quantity_kg: parseFloat(foodFormData.quantity_kg),
      date: foodFormData.date,
      description: foodFormData.description || null,
    };

    if (dialogType === 'entrada') {
      saveFoodEntryMutation.mutate({
        ...data,
        donor_name: foodFormData.donor_name || null,
      });
    } else {
      saveFoodExitMutation.mutate({
        ...data,
        family_name: foodFormData.family_name || null,
      });
    }
  }

  function handleFamilySubmit(e: React.FormEvent) {
    e.preventDefault();
    saveFamilyMutation.mutate({
      family_name: familyFormData.family_name,
      responsible_name: familyFormData.responsible_name || null,
      phone: familyFormData.phone || null,
      address: familyFormData.address || null,
      members_count: familyFormData.members_count ? parseInt(familyFormData.members_count) : null,
      notes: familyFormData.notes || null,
    });
  }

  const totalEntries = entries?.reduce((sum, e) => sum + Number(e.quantity_kg), 0) || 0;
  const totalExits = exits?.reduce((sum, e) => sum + Number(e.quantity_kg), 0) || 0;
  const totalFamilies = families?.length || 0;
  const activeFamilies = families?.filter(f => f.is_active).length || 0;

  // Export donations report by family
  function exportFamilyReport() {
    if (!exits || exits.length === 0) {
      toast.error('Nenhuma distribuição para exportar');
      return;
    }

    // Group exits by family
    const familyData: Record<string, { family: string; items: Array<{ food: string; quantity: number; date: string }> }> = {};
    
    exits.forEach((exit: any) => {
      const familyName = exit.family_name || 'Sem família';
      
      if (!familyData[familyName]) {
        familyData[familyName] = {
          family: familyName,
          items: []
        };
      }
      
      familyData[familyName].items.push({
        food: exit.food_name,
        quantity: Number(exit.quantity_kg),
        date: format(new Date(exit.date), 'dd/MM/yyyy')
      });
    });

    // Build CSV content
    const lines = [];
    
    // Header
    lines.push('Relatório de Doações por Família');
    lines.push(`Período: ${format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}`);
    lines.push('');
    
    // Data for each family
    Object.values(familyData).forEach(({ family, items }) => {
      const totalKg = items.reduce((sum, item) => sum + item.quantity, 0);
      
      lines.push(`Família: ${family}`);
      lines.push(`Total recebido: ${totalKg.toFixed(1)} kg`);
      lines.push('');
      lines.push('Data;Alimento;Quantidade (kg)');
      
      items.forEach(item => {
        lines.push(`${item.date};${item.food};${item.quantity.toFixed(1)}`);
      });
      
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    // Summary
    lines.push('RESUMO GERAL');
    lines.push(`Total de famílias atendidas: ${Object.keys(familyData).length}`);
    lines.push(`Total distribuído: ${totalExits.toFixed(1)} kg`);

    const csvContent = lines.join('\r\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_doacoes_${format(selectedMonth, 'yyyy-MM')}.csv`;
    link.click();
    
    toast.success('Relatório exportado com sucesso!');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-8 w-8 text-red-500" />
            Ação Social
          </h1>
          <p className="text-muted-foreground">
            Controle de doações de alimentos e famílias beneficiadas
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estoque Total</span>
              <Badge variant="secondary" className="text-lg">
                {inventory?.reduce((sum, item) => sum + Number(item.quantity_kg), 0).toFixed(1)} kg
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Entradas (mês)</span>
              <Badge className="bg-green-600 hover:bg-green-700 text-lg">
                {totalEntries.toFixed(1)} kg
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Saídas (mês)</span>
              <Badge className="bg-orange-600 hover:bg-orange-700 text-lg">
                {totalExits.toFixed(1)} kg
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Famílias Ativas</span>
              <Badge className="bg-blue-600 hover:bg-blue-700 text-lg">
                {activeFamilies}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
          <TabsTrigger value="saidas">Saídas</TabsTrigger>
          <TabsTrigger value="familias">Famílias</TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="estoque" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estoque de Alimentos</CardTitle>
              <CardDescription>Quantidade disponível por alimento</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingInventory ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : inventory?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum alimento em estoque
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alimento</TableHead>
                      <TableHead className="text-right">Quantidade (kg)</TableHead>
                      <TableHead className="text-right">Última Atualização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.food_name}</TableCell>
                        <TableCell className="text-right font-mono">
                          <Badge variant={Number(item.quantity_kg) < 10 ? "destructive" : "secondary"}>
                            {Number(item.quantity_kg).toFixed(1)} kg
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {format(new Date(item.updated_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entries Tab */}
        <TabsContent value="entradas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <Input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
              className="w-auto"
            />
            {isAdmin && (
              <Button onClick={() => openDialog('entrada')}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Entrada
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Entradas de Alimentos</CardTitle>
              <CardDescription>
                Doações de {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEntries ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : entries?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma entrada registrada neste mês
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Alimento</TableHead>
                      <TableHead>Doador</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      {isAdmin && <TableHead className="w-24">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries?.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-medium">{entry.food_name}</TableCell>
                        <TableCell>{entry.donor_name || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {Number(entry.quantity_kg).toFixed(1)} kg
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(entry, 'entrada')}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteFoodEntryMutation.mutate(entry.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exits Tab */}
        <TabsContent value="saidas" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <Input
              type="month"
              value={format(selectedMonth, 'yyyy-MM')}
              onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
              className="w-auto"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportFamilyReport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Relatório
              </Button>
              {isAdmin && (
                <Button onClick={() => openDialog('saida')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Saída
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Saídas de Alimentos</CardTitle>
              <CardDescription>
                Distribuições de {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingExits ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : exits?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma saída registrada neste mês
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Alimento</TableHead>
                      <TableHead>Família</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      {isAdmin && <TableHead className="w-24">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exits?.map((exit: any) => (
                      <TableRow key={exit.id}>
                        <TableCell>{format(new Date(exit.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-medium">{exit.food_name}</TableCell>
                        <TableCell>{exit.family_name || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-orange-600">
                          {Number(exit.quantity_kg).toFixed(1)} kg
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(exit, 'saida')}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteFoodExitMutation.mutate(exit.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Families Tab */}
        <TabsContent value="familias" className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={() => openDialog('familia')}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Família
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Famílias Beneficiadas</CardTitle>
              <CardDescription>Cadastro de famílias atendidas pela ação social</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingFamilies ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : families?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma família cadastrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Família</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Membros</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="w-24">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {families?.map((family: any) => (
                      <TableRow key={family.id}>
                        <TableCell className="font-medium">{family.family_name}</TableCell>
                        <TableCell>{family.responsible_name || '-'}</TableCell>
                        <TableCell>{family.phone || '-'}</TableCell>
                        <TableCell>
                          {family.members_count ? `${family.members_count} pessoas` : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={family.is_active ? 'default' : 'secondary'}>
                            {family.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(family, 'familia')}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteFamilyMutation.mutate(family.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog for Food Entries/Exits */}
      <Dialog open={isDialogOpen && dialogType !== 'familia'} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem 
                ? `Editar ${dialogType === 'entrada' ? 'Entrada' : 'Saída'}` 
                : `Nova ${dialogType === 'entrada' ? 'Entrada' : 'Saída'}`}
            </DialogTitle>
            <DialogDescription>
              {dialogType === 'entrada' 
                ? 'Registre uma doação de alimento recebida' 
                : 'Registre a distribuição de alimento para uma família'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFoodSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Alimento *</Label>
                <Input
                  placeholder="Ex: Arroz, Feijão, Açúcar"
                  value={foodFormData.food_name}
                  onChange={(e) =>
                    setFoodFormData({ ...foodFormData, food_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade (kg) *</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  value={foodFormData.quantity_kg}
                  onChange={(e) =>
                    setFoodFormData({ ...foodFormData, quantity_kg: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={foodFormData.date}
                  onChange={(e) =>
                    setFoodFormData({ ...foodFormData, date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{dialogType === 'entrada' ? 'Doador' : 'Família'}</Label>
                {dialogType === 'entrada' ? (
                  <Input
                    placeholder="Nome do doador"
                    value={foodFormData.donor_name}
                    onChange={(e) =>
                      setFoodFormData({ ...foodFormData, donor_name: e.target.value })
                    }
                  />
                ) : (
                  <Select
                    value={foodFormData.family_name || "none"}
                    onValueChange={(v) =>
                      setFoodFormData({ ...foodFormData, family_name: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a família" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {families?.filter(f => f.is_active).map((family) => (
                        <SelectItem key={family.id} value={family.family_name}>
                          {family.family_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Informações adicionais"
                value={foodFormData.description}
                onChange={(e) =>
                  setFoodFormData({ ...foodFormData, description: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={saveFoodEntryMutation.isPending || saveFoodExitMutation.isPending}
              >
                {(saveFoodEntryMutation.isPending || saveFoodExitMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog for Families */}
      <Dialog open={isDialogOpen && dialogType === 'familia'} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Família' : 'Nova Família'}
            </DialogTitle>
            <DialogDescription>
              Cadastre uma família beneficiada pela ação social
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFamilySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Família *</Label>
              <Input
                placeholder="Ex: Família Silva"
                value={familyFormData.family_name}
                onChange={(e) =>
                  setFamilyFormData({ ...familyFormData, family_name: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input
                  placeholder="Nome do responsável"
                  value={familyFormData.responsible_name}
                  onChange={(e) =>
                    setFamilyFormData({ ...familyFormData, responsible_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={familyFormData.phone}
                  onChange={(e) =>
                    setFamilyFormData({ ...familyFormData, phone: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                placeholder="Rua, número, bairro"
                value={familyFormData.address}
                onChange={(e) =>
                  setFamilyFormData({ ...familyFormData, address: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Número de Membros</Label>
              <Input
                type="number"
                min="1"
                placeholder="Quantas pessoas"
                value={familyFormData.members_count}
                onChange={(e) =>
                  setFamilyFormData({ ...familyFormData, members_count: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Informações sobre a família"
                value={familyFormData.notes}
                onChange={(e) =>
                  setFamilyFormData({ ...familyFormData, notes: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveFamilyMutation.isPending}>
                {saveFamilyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
