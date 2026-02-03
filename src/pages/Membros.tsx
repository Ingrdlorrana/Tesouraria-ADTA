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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus, Pencil, Trash2, Users, Loader2, MapPin, Instagram, Upload, Download, FileSpreadsheet } from 'lucide-react';

export default function Membros() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    church_role: '',
    social_media: '',
    birth_date: '',
    baptism_date: '',
    civil_status: '',
    is_ministry: false,
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
      address: '',
      church_role: '',
      social_media: '',
      birth_date: '',
      baptism_date: '',
      civil_status: '',
      is_ministry: false,
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
      address: member.address || '',
      church_role: member.church_role || '',
      social_media: member.social_media || '',
      birth_date: member.birth_date || '',
      baptism_date: member.baptism_date || '',
      civil_status: member.civil_status || '',
      is_ministry: member.is_ministry || false,
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
      address: formData.address || null,
      church_role: formData.church_role || null,
      social_media: formData.social_media || null,
      birth_date: formData.birth_date || null,
      baptism_date: formData.baptism_date || null,
      civil_status: formData.civil_status || null,
      is_ministry: formData.is_ministry,
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

    function convertDate(dateStr: string): string | null {
      if (!dateStr || dateStr.trim() === '') return null;
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month}-${day}`;
      }
      
      return null;
    }

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length === 0) {
        toast.error('Arquivo vazio');
        setIsImporting(false);
        return;
      }

      const dataLines = lines.slice(1);
      const membersToImport = [];

      for (const line of dataLines) {
        const values = line.split(/[,;]/).map(v => v.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));
        
        if (values.length < 1 || !values[0]) continue;

        const member = {
          name: values[0] || null,
          phone: values[1] || null,
          email: values[2] || null,
          address: values[3] || null,
          church_role: values[4] || null,
          social_media: values[5] || null,
          birth_date: convertDate(values[6]),
          baptism_date: convertDate(values[7]),
          civil_status: values[8] || null,
          is_ministry: values[9]?.toLowerCase() === 'sim' || values[9]?.toLowerCase() === 'true',
        };

        if (member.name) {
          membersToImport.push(member);
        }
      }

      if (membersToImport.length === 0) {
        toast.error('Nenhum dado válido encontrado no arquivo');
        setIsImporting(false);
        return;
      }

      const { error } = await supabase.from('members').insert(membersToImport);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['all-members'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success(`${membersToImport.length} membros importados com sucesso!`);
      
      setIsImportDialogOpen(false);
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
      'Endereco',
      'Funcao',
      'Rede Social',
      'Data Nascimento',
      'Data Batismo',
      'Estado Civil',
      'Ministerio'
    ];
    
    const exampleRow = [
      'Joao Silva',
      '(11) 99999-9999',
      'joao@email.com',
      'Rua Exemplo 123',
      'Diacono',
      '@joaosilva',
      '15/05/1990',
      '25/12/2010',
      'Casado',
      'sim'
    ];

    const csvContent = [
      headers.join(','),
      exampleRow.join(',')
    ].join('\r\n');

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
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Função na Igreja</Label>
                      <Input
                        placeholder="Ex: Diácono, Líder de Louvor"
                        value={formData.church_role}
                        onChange={(e) =>
                          setFormData({ ...formData, church_role: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rede Social</Label>
                      <Input
                        placeholder="@usuario"
                        value={formData.social_media}
                        onChange={(e) =>
                          setFormData({ ...formData, social_media: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Estado Civil</Label>
                      <Select
                        value={formData.civil_status}
                        onValueChange={(v) =>
                          setFormData({ ...formData, civil_status: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="Casado">Casado(a)</SelectItem>
                          <SelectItem value="Divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="Viúvo">Viúvo(a)</SelectItem>
                          <SelectItem value="União Estável">União Estável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex items-end">
                      <div className="flex items-center space-x-2 pb-2">
                        <Checkbox
                          id="is_ministry"
                          checked={formData.is_ministry}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, is_ministry: checked as boolean })
                          }
                        />
                        <Label
                          htmlFor="is_ministry"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Participa do Ministério
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Anotações sobre o membro"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      rows={3}
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

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Importar Membros</DialogTitle>
            <DialogDescription>
              Importe membros de uma planilha CSV ou Excel (.csv)
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Selecione um arquivo .csv com os dados dos membros
            </p>
            
            <input
              id="file-import-input"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileImport}
              className="hidden"
            />
            
            <Button
              variant="outline"
              onClick={() => document.getElementById('file-import-input')?.click()}
              disabled={isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Escolher arquivo
                </>
              )}
            </Button>

            <div className="w-full">
              <p className="text-xs text-muted-foreground mb-2">Colunas esperadas:</p>
              <p className="text-xs text-muted-foreground">
                Nome, Telefone, Email, Endereço, Função, Rede Social, Data Nascimento, 
                Data Batismo, Estado Civil, Ministério
              </p>
            </div>

            <Button
              variant="ghost"
              onClick={downloadTemplate}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Modelo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <span className="text-sm text-muted-foreground">No Ministério</span>
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
                    <TableHead>Telefone</TableHead>
                    <TableHead>Estado Civil</TableHead>
                    <TableHead>Ministério</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TooltipProvider>
                    {filteredMembers?.map((member: any) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {member.address && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MapPin className="h-3 w-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{member.address}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {member.social_media && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Instagram className="h-3 w-3 text-pink-600 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{member.social_media}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <span>{member.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{member.phone || '-'}</TableCell>
                        <TableCell>{member.civil_status || '-'}</TableCell>
                        <TableCell>
                          {member.is_ministry ? (
                            <Badge className="bg-purple-600 hover:bg-purple-700">Sim</Badge>
                          ) : (
                            <span className="text-muted-foreground">Não</span>
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
