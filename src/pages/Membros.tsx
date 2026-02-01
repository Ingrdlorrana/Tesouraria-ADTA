import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, Users, Loader2, MapPin } from 'lucide-react';

export default function Membros() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birth_date: '',
    baptism_date: '',
    church_role: '',
    is_ministry: false,
    address: '',
    notes: '',
  });

  // Fetch members
  const { data: members, isLoading } = useQuery({
    queryKey: ['all-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMember) {
        const { error } = await supabase
          .from('members')
          .update(data)
          .eq('id', editingMember.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('members').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-members'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success(editingMember ? 'Membro atualizado!' : 'Membro cadastrado!');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-members'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Membro removido!');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover', { description: error.message });
    },
  });

  // Toggle active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('members')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-members'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  function openNewDialog() {
    setEditingMember(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      birth_date: '',
      baptism_date: '',
      church_role: '',
      is_ministry: false,
      address: '',
      notes: '',
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(member: any) {
    setEditingMember(member);
    setFormData({
      name: member.name,
      phone: member.phone || '',
      email: member.email || '',
      birth_date: member.birth_date || '',
      baptism_date: member.baptism_date || '',
      church_role: member.church_role || '',
      is_ministry: member.is_ministry || false,
      address: member.address || '',
      notes: member.notes || '',
    });
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingMember(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      name: formData.name,
      phone: formData.phone || null,
      email: formData.email || null,
      birth_date: formData.birth_date || null,
      baptism_date: formData.baptism_date || null,
      church_role: formData.church_role || null,
      is_ministry: formData.is_ministry,
      address: formData.address || null,
      notes: formData.notes || null,
    });
  }

  const filteredMembers = members?.filter((member) =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = members?.filter((m) => m.is_active).length || 0;
  const inactiveCount = members?.filter((m) => !m.is_active).length || 0;
  const ministryCount = members?.filter((m) => m.is_ministry).length || 0;

  // Calculate age from birth date
  function calculateAge(birthDate: string): number | null {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  // Handle file import
  async function handleFileImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    // Convert date from DD/MM/YYYY to YYYY-MM-DD
    function convertDate(dateStr: string): string | null {
      if (!dateStr || dateStr.trim() === '') return null;
      
      // If already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      // If in DD/MM/YYYY format
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
      }
      
      return null;
    }

    try {
      const text = await file.text();
      console.log('File content:', text); // Debug
      
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('Arquivo vazio');
        setIsImporting(false);
        return;
      }

      console.log('Total lines:', lines.length); // Debug

      // Skip header row
      const dataLines = lines.slice(1);
      const membersToImport = [];

      for (const line of dataLines) {
        // Split by semicolon (Excel format)
        const values = line.split(';').map(v => v.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));
        
        console.log('Processing line:', values); // Debug
        
        if (values.length < 1 || !values[0]) continue;

        const member = {
          name: values[0] || null,
          phone: values[1] || null,
          email: values[2] || null,
          birth_date: convertDate(values[3]),
          baptism_date: convertDate(values[4]),
          church_role: values[5] || null,
          is_ministry: values[6]?.toLowerCase() === 'sim' || values[6]?.toLowerCase() === 'true',
          address: values[7] || null,
          notes: values[8] || null,
        };

        if (member.name) {
          membersToImport.push(member);
        }
      }

      console.log('Members to import:', membersToImport); // Debug

      if (membersToImport.length === 0) {
        toast.error('Nenhum dado válido encontrado no arquivo');
        setIsImporting(false);
        return;
      }

      // Insert all members
      const { data, error } = await supabase.from('members').insert(membersToImport);

      if (error) {
        console.error('Supabase error:', error); // Debug
        throw error;
      }

      console.log('Import successful:', data); // Debug

      queryClient.invalidateQueries({ queryKey: ['all-members'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success(`${membersToImport.length} membros importados com sucesso!`);
      
      // Reset file input
      if (event.target) event.target.value = '';
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Erro ao importar arquivo', { description: error.message });
    } finally {
      setIsImporting(false);
    }
  }

  // Download template CSV
  function downloadTemplate() {
    const headers = [
      'Nome',
      'Telefone',
      'Email',
      'Data Nascimento (DD/MM/AAAA ou AAAA-MM-DD)',
      'Data Batismo (DD/MM/AAAA ou AAAA-MM-DD)',
      'Funcao',
      'Ministerio (sim/nao)',
      'Endereco',
      'Observacoes'
    ];
    
    const exampleRow = [
      'Joao Silva',
      '(11) 99999-9999',
      'joao@email.com',
      '15/05/1990',
      '25/12/2010',
      'Diacono',
      'sim',
      'Rua Exemplo 123 Centro Sao Paulo',
      'Membro ativo desde 2010'
    ];

    // Use semicolon for better Excel compatibility
    const csvContent = [
      headers.join(';'),
      exampleRow.join(';')
    ].join('\r\n');

    // Add BOM for Excel UTF-8 recognition
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_importacao_membros.csv';
    link.click();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Membros
          </h1>
          <p className="text-muted-foreground">
            Cadastro de membros da igreja
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              Baixar Modelo
            </Button>
            <Button
              variant="outline"
              onClick={() => document.getElementById('file-import')?.click()}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                'Importar CSV'
              )}
            </Button>
            <input
              id="file-import"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileImport}
              className="hidden"
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Membro
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? 'Editar Membro' : 'Novo Membro'}
                </DialogTitle>
                <DialogDescription>
                  {editingMember
                    ? 'Atualize os dados do membro'
                    : 'Cadastre um novo membro'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Nome completo"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) =>
                      setFormData({ ...formData, birth_date: e.target.value })
                    }
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Batismo</Label>
                    <Input
                      type="date"
                      value={formData.baptism_date}
                      onChange={(e) =>
                        setFormData({ ...formData, baptism_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Função na Igreja</Label>
                    <Input
                      placeholder="Ex: Diácono, Pastor, Líder..."
                      value={formData.church_role}
                      onChange={(e) =>
                        setFormData({ ...formData, church_role: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    placeholder="Rua, número, bairro, cidade"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_ministry"
                    checked={formData.is_ministry}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_ministry: checked as boolean })
                    }
                  />
                  <Label
                    htmlFor="is_ministry"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Faz parte do ministério
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Anotações sobre o membro"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
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
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <Badge variant="secondary">{members?.length || 0}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ativos</span>
              <Badge variant="default">{activeCount}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Inativos</span>
              <Badge variant="outline">{inactiveCount}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ministério</span>
              <Badge className="bg-purple-600 hover:bg-purple-700">{ministryCount}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Input
        placeholder="Buscar por nome..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Membros</CardTitle>
          <CardDescription>
            Todos os membros cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredMembers?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum membro encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Idade</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Batismo</TableHead>
                    <TableHead>Ministério</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cadastro</TableHead>
                    {isAdmin && <TableHead className="w-24">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider>
                    {filteredMembers?.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.address ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <MapPin className="h-3 w-3 text-muted-foreground" />
                                  <span>{member.name}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{member.address}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            member.name
                          )}
                        </TableCell>
                      <TableCell>
                        {member.birth_date
                          ? `${calculateAge(member.birth_date)} anos`
                          : '-'}
                      </TableCell>
                      <TableCell>{member.phone || '-'}</TableCell>
                      <TableCell>{member.church_role || '-'}</TableCell>
                      <TableCell>
                        {member.baptism_date
                          ? format(new Date(member.baptism_date), 'dd/MM/yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {member.is_ministry && (
                          <Badge className="bg-purple-600 hover:bg-purple-700">
                            Sim
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.is_active ? 'default' : 'secondary'}
                          className="cursor-pointer"
                          onClick={() =>
                            isAdmin &&
                            toggleActiveMutation.mutate({
                              id: member.id,
                              is_active: !member.is_active,
                            })
                          }
                        >
                          {member.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(member.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(member)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(member.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  </TooltipProvider>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
