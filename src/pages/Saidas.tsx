import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/useFinancialData';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, ArrowUpCircle, Loader2 } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function Saidas() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { data: categories } = useCategories('expense');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    beneficiary: '',
    is_recurring: false,
  });

  const startDate = startOfMonth(selectedMonth);
  const endDate = endOfMonth(selectedMonth);

  // Fetch entries
  const { data: entries, isLoading } = useQuery({
    queryKey: ['expense-entries', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_entries')
        .select(`
          *,
          category:categories(name)
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingEntry) {
        const { error } = await supabase
          .from('expense_entries')
          .update(data)
          .eq('id', editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expense_entries')
          .insert({ ...data, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-entries'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-totals'] });
      queryClient.invalidateQueries({ queryKey: ['category-totals'] });
      queryClient.invalidateQueries({ queryKey: ['recent-entries'] });
      toast.success(editingEntry ? 'Saída atualizada!' : 'Saída registrada!');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expense_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-entries'] });
      queryClient.invalidateQueries({ queryKey: ['monthly-totals'] });
      queryClient.invalidateQueries({ queryKey: ['category-totals'] });
      queryClient.invalidateQueries({ queryKey: ['recent-entries'] });
      toast.success('Saída excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir', { description: error.message });
    },
  });

  function openNewDialog() {
    setEditingEntry(null);
    setFormData({
      category_id: '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      beneficiary: '',
      is_recurring: false,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(entry: any) {
    setEditingEntry(entry);
    setFormData({
      category_id: entry.category_id,
      amount: String(entry.amount),
      date: entry.date,
      description: entry.description || '',
      beneficiary: entry.beneficiary || '',
      is_recurring: entry.is_recurring,
    });
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingEntry(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      category_id: formData.category_id,
      amount: parseFloat(formData.amount),
      date: formData.date,
      description: formData.description || null,
      beneficiary: formData.beneficiary || null,
      is_recurring: formData.is_recurring,
    });
  }

  const totalMonth = entries?.reduce((sum, entry) => sum + Number(entry.amount), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ArrowUpCircle className="h-8 w-8 text-red-500" />
            Saídas
          </h1>
          <p className="text-muted-foreground">
            Gerencie as despesas da igreja
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Saída
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Editar Saída' : 'Nova Saída'}
                </DialogTitle>
                <DialogDescription>
                  {editingEntry
                    ? 'Atualize os dados da saída'
                    : 'Registre uma nova despesa'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria *</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(v) =>
                        setFormData({ ...formData, category_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
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
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Beneficiário</Label>
                    <Input
                      placeholder="Ex: Fornecedor X"
                      value={formData.beneficiary}
                      onChange={(e) =>
                        setFormData({ ...formData, beneficiary: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Observações sobre a saída"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_recurring"
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_recurring: !!checked })
                    }
                  />
                  <Label htmlFor="is_recurring" className="font-normal">
                    Despesa fixa/recorrente
                  </Label>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDialog}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? (
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
        )}
      </div>

      {/* Month Selector & Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Input
          type="month"
          value={format(selectedMonth, 'yyyy-MM')}
          onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
          className="w-auto"
        />
        <Card className="w-full sm:w-auto">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total do mês:</span>
              <Badge variant="destructive" className="text-lg font-bold">
                {formatCurrency(totalMonth)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lançamentos</CardTitle>
          <CardDescription>
            Saídas de {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : entries?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma saída registrada neste mês
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {isAdmin && <TableHead className="w-24">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries?.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {format(new Date(entry.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{entry.category?.name}</Badge>
                      </TableCell>
                      <TableCell>{entry.beneficiary || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {entry.description || '-'}
                      </TableCell>
                      <TableCell>
                        {entry.is_recurring ? (
                          <Badge variant="outline">Fixa</Badge>
                        ) : (
                          <Badge variant="outline">Variável</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {formatCurrency(Number(entry.amount))}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(entry)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(entry.id)}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
