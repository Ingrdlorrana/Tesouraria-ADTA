import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Settings, Church, Tags, Users, Loader2, Shield, Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Category = Database['public']['Tables']['categories']['Row'];
type CategoryType = Database['public']['Enums']['category_type'];

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const { isAdmin, profile } = useAuth();

  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'income' as CategoryType,
    description: '',
  });

  // Church settings
  const { data: churchSettings, isLoading: loadingChurch } = useQuery({
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

  // Categories
  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ['all-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('type')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Users with roles
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          user_roles(role)
        `)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Church settings form
  const [churchForm, setChurchForm] = useState({
    name: '',
    cnpj: '',
    address: '',
    phone: '',
  });

  // Update church form when settings load
  useEffect(() => {
    if (churchSettings) {
      setChurchForm({
        name: churchSettings.name || '',
        cnpj: churchSettings.cnpj || '',
        address: churchSettings.address || '',
        phone: churchSettings.phone || '',
      });
    }
  }, [churchSettings]);

  // Update church mutation
  const updateChurchMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('church_settings')
        .update(data)
        .eq('id', churchSettings?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church-settings'] });
      toast.success('Configurações atualizadas!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar', { description: error.message });
    },
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; type: CategoryType; description: string | null }) => {
      const { error } = await supabase.from('categories').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria criada!');
      closeCategoryDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao criar categoria', { description: error.message });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string | null } }) => {
      const { error } = await supabase.from('categories').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria atualizada!');
      closeCategoryDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar categoria', { description: error.message });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoria excluída!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir categoria', { description: error.message });
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'viewer' }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Permissão atualizada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar', { description: error.message });
    },
  });

  // Delete user mutation (removes from profiles and user_roles)
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // First delete the user role
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (roleError) throw roleError;

      // Then delete the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Usuário removido!');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover usuário', { description: error.message });
    },
  });

  function handleSaveChurch(e: React.FormEvent) {
    e.preventDefault();
    updateChurchMutation.mutate({
      name: churchForm.name,
      cnpj: churchForm.cnpj || null,
      address: churchForm.address || null,
      phone: churchForm.phone || null,
    });
  }

  function openNewCategoryDialog() {
    setEditingCategory(null);
    setCategoryForm({ name: '', type: 'income', description: '' });
    setCategoryDialogOpen(true);
  }

  function openEditCategoryDialog(category: Category) {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      type: category.type,
      description: category.description || '',
    });
    setCategoryDialogOpen(true);
  }

  function closeCategoryDialog() {
    setCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', type: 'income', description: '' });
  }

  function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        data: {
          name: categoryForm.name,
          description: categoryForm.description || null,
        },
      });
    } else {
      createCategoryMutation.mutate({
        name: categoryForm.name,
        type: categoryForm.type,
        description: categoryForm.description || null,
      });
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Apenas administradores podem acessar as configurações.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="igreja" className="space-y-4">
        <TabsList>
          <TabsTrigger value="igreja">
            <Church className="h-4 w-4 mr-2" />
            Igreja
          </TabsTrigger>
          <TabsTrigger value="categorias">
            <Tags className="h-4 w-4 mr-2" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="usuarios">
            <Users className="h-4 w-4 mr-2" />
            Usuários
          </TabsTrigger>
        </TabsList>

        {/* Igreja Tab */}
        <TabsContent value="igreja">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Igreja</CardTitle>
              <CardDescription>
                Informações que aparecem nos relatórios
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingChurch ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <form onSubmit={handleSaveChurch} className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label>Nome da Igreja *</Label>
                    <Input
                      value={churchForm.name || churchSettings?.name || ''}
                      onChange={(e) =>
                        setChurchForm({ ...churchForm, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={churchForm.cnpj || churchSettings?.cnpj || ''}
                      onChange={(e) =>
                        setChurchForm({ ...churchForm, cnpj: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input
                      placeholder="Rua, número, bairro, cidade"
                      value={churchForm.address || churchSettings?.address || ''}
                      onChange={(e) =>
                        setChurchForm({ ...churchForm, address: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={churchForm.phone || churchSettings?.phone || ''}
                      onChange={(e) =>
                        setChurchForm({ ...churchForm, phone: e.target.value })
                      }
                    />
                  </div>
                  <Button type="submit" disabled={updateChurchMutation.isPending}>
                    {updateChurchMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Alterações'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categorias Tab */}
        <TabsContent value="categorias">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Categorias</CardTitle>
                <CardDescription>
                  Categorias de entradas e saídas
                </CardDescription>
              </div>
              <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
                if (open) openNewCategoryDialog();
                else closeCategoryDialog();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingCategory
                        ? 'Atualize os dados da categoria'
                        : 'Preencha os dados para criar uma nova categoria'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveCategory} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        value={categoryForm.name}
                        onChange={(e) =>
                          setCategoryForm({ ...categoryForm, name: e.target.value })
                        }
                        placeholder="Nome da categoria"
                        required
                      />
                    </div>
                    {!editingCategory && (
                      <div className="space-y-2">
                        <Label>Tipo *</Label>
                        <Select
                          value={categoryForm.type}
                          onValueChange={(v: CategoryType) =>
                            setCategoryForm({ ...categoryForm, type: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Entrada</SelectItem>
                            <SelectItem value="expense">Saída</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Textarea
                        value={categoryForm.description}
                        onChange={(e) =>
                          setCategoryForm({ ...categoryForm, description: e.target.value })
                        }
                        placeholder="Descrição opcional"
                        rows={3}
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeCategoryDialog}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={
                          createCategoryMutation.isPending ||
                          updateCategoryMutation.isPending
                        }
                      >
                        {(createCategoryMutation.isPending ||
                          updateCategoryMutation.isPending) && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {editingCategory ? 'Salvar' : 'Criar'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingCategories ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Padrão</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories?.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={cat.type === 'income' ? 'default' : 'destructive'}
                          >
                            {cat.type === 'income' ? 'Entrada' : 'Saída'}
                          </Badge>
                        </TableCell>
                        <TableCell>{cat.description || '-'}</TableCell>
                        <TableCell>
                          {cat.is_default ? (
                            <Badge variant="outline">Sim</Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditCategoryDialog(cat)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!cat.is_default && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Excluir categoria?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir a categoria "{cat.name}"?
                                      Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteCategoryMutation.mutate(cat.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usuários Tab */}
        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>
                Defina os níveis de acesso dos usuários. Para adicionar novos usuários, eles precisam se cadastrar na tela de login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Nível de Acesso</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user: any) => {
                      const currentRole = user.user_roles?.[0]?.role || 'viewer';
                      const isCurrentUser = user.user_id === profile?.user_id;

                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.name}
                            {isCurrentUser && (
                              <Badge variant="outline" className="ml-2">
                                Você
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Select
                              value={currentRole}
                              onValueChange={(value: 'admin' | 'viewer') =>
                                updateRoleMutation.mutate({
                                  userId: user.user_id,
                                  role: value,
                                })
                              }
                              disabled={isCurrentUser}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    Administrador
                                  </div>
                                </SelectItem>
                                <SelectItem value="viewer">
                                  Visualizador
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {!isCurrentUser && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Remover usuário?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja remover "{user.name}" do sistema?
                                      O usuário não terá mais acesso à aplicação.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUserMutation.mutate(user.user_id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
