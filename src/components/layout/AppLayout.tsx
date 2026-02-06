import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  FileBarChart,
  HeartHandshake,
  Settings,
  LogOut,
  Menu,
  Calendar,
  Bell,
  ChevronLeft,
  ChevronRight,
  Cake,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, getDay, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- NAVEGAÇÃO ---
const mainNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, subtitle: 'Visão geral das atividades' },
  { name: 'Calendário', href: '/calendario', icon: Calendar, subtitle: 'Eventos e programações' },
  { name: 'Entradas', href: '/entradas', icon: ArrowDownCircle, subtitle: 'Registro de receitas' },
  { name: 'Saídas', href: '/saidas', icon: ArrowUpCircle, subtitle: 'Registro de despesas' },
  { name: 'Ação Social', href: '/acaosocial', icon: HeartHandshake, subtitle: 'Projetos sociais' },
  { name: 'Membros', href: '/membros', icon: Users, subtitle: 'Cadastro de membros' },
  { name: 'Relatórios', href: '/relatorios', icon: FileBarChart, subtitle: 'Análises e estatísticas' },
];

const footerNavigation = [
  { name: 'Configurações', href: '/configuracoes', icon: Settings, subtitle: 'Preferências do sistema' },
];

// --- TIPOS ---
interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  type: 'event' | 'birthday';
  time?: string;
  isBirthday?: boolean;
}

interface AppLayoutProps {
  children: ReactNode;
}

// --- FUNÇÃO AUXILIAR PARA FORMATAÇÃO DE DATA ---
function formatEventDate(dateStr: string, timeStr?: string): string {
  const eventDate = parseISO(dateStr);
  
  if (isToday(eventDate)) {
    return timeStr ? `Hoje, ${timeStr.slice(0, 5)}` : 'Hoje';
  }
  
  if (isTomorrow(eventDate)) {
    return timeStr ? `Amanhã, ${timeStr.slice(0, 5)}` : 'Amanhã';
  }
  
  // Para outros dias da semana
  const dayName = format(eventDate, 'EEEE', { locale: ptBR });
  const dayCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  
  if (timeStr) {
    return `${dayCapitalized}, ${timeStr.slice(0, 5)}`;
  }
  
  return `${dayCapitalized}, ${format(eventDate, 'dd/MM')}`;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // --- BUSCAR PRÓXIMOS EVENTOS ---
  useEffect(() => {
    async function fetchUpcomingEvents() {
      try {
        setLoadingEvents(true);
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30); // Próximos 30 dias
        const futureDateStr = format(futureDate, 'yyyy-MM-dd');

        // 1. Buscar eventos diretos
        const { data: directEvents, error: eventsError } = await supabase
          .from('calendar_events')
          .select('*')
          .gte('date', todayStr)
          .lte('date', futureDateStr)
          .order('date')
          .order('time')
          .limit(5);

        if (eventsError) throw eventsError;

        // 2. Buscar eventos recorrentes
        const { data: recurringEvents, error: recurringError } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('is_recurring', true);

        if (recurringError) throw recurringError;

        // 3. Buscar aniversários
        const { data: birthdays, error: birthdaysError } = await supabase
          .from('members')
          .select('id, name, birth_date')
          .not('birth_date', 'is', null)
          .eq('is_active', true);

        if (birthdaysError) throw birthdaysError;

        // Processar todos os eventos
        const allEvents: UpcomingEvent[] = [];

        // Adicionar eventos diretos
        directEvents?.forEach(event => {
          allEvents.push({
            id: event.id,
            title: event.title,
            date: event.date,
            time: event.time,
            type: 'event',
          });
        });

        // Adicionar eventos recorrentes que ocorrem nos próximos 30 dias
        recurringEvents?.forEach(event => {
          const currentDate = new Date(today);
          const endDate = new Date(futureDate);

          while (currentDate <= endDate) {
            const dow = getDay(currentDate);
            const year = getYear(currentDate);

            if (Number(event.recurrence_day) === dow) {
              // Verificar se o evento recorrente tem ano específico
              if (event.recurrence_year == null || Number(event.recurrence_year) === year) {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                
                // Não adicionar se já existe um evento direto nesta data
                const hasDirectEvent = directEvents?.some(de => de.id === event.id && de.date === dateStr);
                
                if (!hasDirectEvent && currentDate >= today) {
                  allEvents.push({
                    id: `${event.id}-${dateStr}`,
                    title: event.title,
                    date: dateStr,
                    time: event.time,
                    type: 'event',
                  });
                }
              }
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        });

        // Adicionar aniversários nos próximos 30 dias
        birthdays?.forEach(member => {
          const birthDate = parseISO(member.birth_date);
          const currentYear = getYear(today);
          
          // Criar data de aniversário para este ano
          const birthdayThisYear = new Date(
            currentYear,
            birthDate.getMonth(),
            birthDate.getDate()
          );

          // Se o aniversário já passou este ano, usar o próximo ano
          if (birthdayThisYear < today) {
            birthdayThisYear.setFullYear(currentYear + 1);
          }

          // Verificar se está nos próximos 30 dias
          if (birthdayThisYear <= futureDate) {
            allEvents.push({
              id: `birthday-${member.id}`,
              title: member.name,
              date: format(birthdayThisYear, 'yyyy-MM-dd'),
              type: 'birthday',
              isBirthday: true,
            });
          }
        });

        // Ordenar por data e pegar os 3 primeiros
        const sortedEvents = allEvents
          .sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return (a.time || '').localeCompare(b.time || '');
          })
          .slice(0, 3);

        setUpcomingEvents(sortedEvents);
      } catch (error) {
        console.error('Erro ao buscar eventos:', error);
      } finally {
        setLoadingEvents(false);
      }
    }

    fetchUpcomingEvents();

    // Atualizar a cada 5 minutos
    const interval = setInterval(fetchUpcomingEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const getInitials = (name: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const NavLinks = ({ items, onClick, collapsed }: { items: typeof mainNavigation; onClick?: () => void; collapsed?: boolean }) => (
    <>
      {items.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 mb-1',
              isActive
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-muted-foreground hover:bg-slate-100 hover:text-slate-800',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? item.name : ''}
          >
            <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "")} />
            {!collapsed && <span className="truncate">{item.name}</span>}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-white flex overflow-hidden">
      {/* --- SIDEBAR (Desktop) --- */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-50 hidden h-screen bg-white transition-all duration-300 lg:block",
          isSidebarCollapsed ? "w-20" : "w-64"
        )}
      >
        <div className="relative flex h-full flex-col">
          {/* Logo */}
          <div className={cn(
            "flex h-14 items-center transition-all duration-300",
            isSidebarCollapsed ? "justify-center px-0" : "px-6"
          )}>
            <div className="flex items-center gap-3 overflow-hidden">
              <img src="/ADTA.svg" alt="Logo da Igreja" className="h-10 w-10 shrink-0" />
              {!isSidebarCollapsed && (
                <span className="font-bold text-lg tracking-tight text-slate-800">ADTA</span>
              )}
            </div>
          </div>

          {/* Navegação Principal */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            <NavLinks items={mainNavigation} collapsed={isSidebarCollapsed} />
          </nav>

          {/* Navegação do Rodapé */}
          <div className="p-4">
            <div className="mb-2 border-t pt-4">
              <NavLinks items={footerNavigation} collapsed={isSidebarCollapsed} />
            </div>
          </div>
        </div>
      </aside>

      {/* --- WRAPPER DO CONTEÚDO PRINCIPAL --- */}
      <div 
        className={cn(
          "flex flex-col flex-1 h-screen transition-all duration-300 relative overflow-hidden",
          isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        )}
      >
        {/* --- HEADER (Topbar) --- */}
        <header className={cn(
          "fixed top-0 right-0 z-40 flex h-14 items-center justify-between bg-white transition-all duration-300",
          "left-0 px-4 lg:px-4",
          isSidebarCollapsed ? "lg:left-20" : "lg:left-64"
        )}>
          <div className="flex items-center gap-3">
            {/* Gatilho do Menu Mobile */}
            <div className="lg:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 flex flex-col">
                  <div className="flex h-14 items-center px-6">
                    <div className="flex items-center gap-3">
                      <img src="/ADTA.svg" alt="Logo da Igreja" className="h-10 w-10" />
                      <span className="font-bold text-lg">ADTA</span>
                    </div>
                  </div>
                  <nav className="flex-1 space-y-1 p-4">
                    <NavLinks items={mainNavigation} onClick={() => setMobileMenuOpen(false)} />
                  </nav>
                  <div className="p-4 border-t">
                    <NavLinks items={footerNavigation} onClick={() => setMobileMenuOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            
            {/* Título da Página */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-3">
                {(() => {
                  const currentPage = [...mainNavigation, ...footerNavigation].find(item => item.href === location.pathname) || mainNavigation[0];
                  const Icon = currentPage.icon;
                  
                  // Definir cor do ícone baseado na página
                  let iconColor = 'text-slate-800'; // Preto para padrão
                  if (currentPage.name === 'Entradas') {
                    iconColor = 'text-green-600';
                  } else if (currentPage.name === 'Saídas') {
                    iconColor = 'text-red-600';
                  }
                  
                  return (
                    <>
                      <Icon className={`h-6 w-6 ${iconColor}`} />
                      <div>
                        <h1 className="text-2xl font-bold text-slate-800 leading-tight">
                          {currentPage.name}
                        </h1>
                        <p className="text-xs text-muted-foreground">
                          {currentPage.subtitle}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Seção do Usuário */}
          <div className="flex items-center gap-2 sm:gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-slate-100 h-10 w-10">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {upcomingEvents.length > 0 && (
                    <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-slate-800"></span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Próximos Eventos</span>
                  <Link to="/calendario" className="text-xs text-slate-800 hover:underline">Ver tudo</Link>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-64 overflow-y-auto">
                  {loadingEvents ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Carregando...
                    </div>
                  ) : upcomingEvents.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">
                      Nenhum evento próximo
                    </div>
                  ) : (
                    upcomingEvents.map((event) => (
                      <DropdownMenuItem 
                        key={event.id} 
                        className="flex flex-col items-start p-3 cursor-pointer hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-2 w-full">
                          {event.isBirthday && (
                            <Cake className="h-4 w-4 text-pink-500 shrink-0" />
                          )}
                          <p className="text-sm font-medium truncate flex-1">
                            {event.isBirthday ? `🎂 ${event.title}` : event.title}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatEventDate(event.date, event.time)}
                        </p>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-50 transition-colors text-left outline-none">
                  <Avatar className="h-9 w-9 border-2 border-slate-200">
                    <AvatarFallback className="bg-slate-800 text-white font-bold text-xs">
                      {getInitials(profile?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block">
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {profile?.name || 'Usuário'}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {isAdmin ? 'Administrador' : 'Visualizador'}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Botão de Toggle da Sidebar - Apenas Desktop */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={cn(
            "hidden lg:flex fixed top-[80px] z-50 h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-accent transition-all duration-300",
            isSidebarCollapsed ? "left-[68px]" : "left-[244px]"
          )}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* --- CONTEÚDO PRINCIPAL --- */}
        <main className="h-[calc(100vh-3.5rem)] mt-14 px-3 pt-[5px] pb-6 lg:pl-0">
          <div className="h-full bg-white rounded-xl border border-gray-200 shadow-inner overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
