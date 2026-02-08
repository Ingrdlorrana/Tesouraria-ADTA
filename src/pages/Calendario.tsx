import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isBefore,
  addMonths,
  subMonths,
  parseISO,
  getDay,
  getYear,
  setMonth,
  setYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Calendar as CalendarIcon,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Cake,
  Church,
  List,
  RotateCcw,
  Lock,
  X,
  Filter,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constantes Fixas ────────────────────────────────────────────────────────
const BIRTHDAY_TAG = { value: '__birthday__', label: 'Aniversários', color: 'bg-pink-400' };

const DAYS_OF_WEEK = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
];

const MONTHS_PT = [
  'Jan','Fev','Mar','Abr','Mai','Jun',
  'Jul','Ago','Set','Out','Nov','Dez',
];

// ─── Componente principal ────────────────────────────────────────────────────
export default function Calendario() {
  const queryClient = useQueryClient();
  const { isAdmin }  = useAuth();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'year'>('calendar');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendario' | 'servico'>('calendario');

  const [formData, setFormData] = useState({
    title:            '',
    description:      '',
    date:             format(new Date(), 'yyyy-MM-dd'),
    time:             '',
    department:       '',
    event_type:       'event',
    is_recurring:     false,
    recurrence_day:   '0',
    recurrence_year:  null as number | null,
  });

  // ── Query de Departamentos (Dinâmica) ──────────────────────────────────────
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // ── Queries de Eventos ─────────────────────────────────────────────────────
  const startDate = startOfMonth(currentMonth);
  const endDate   = endOfMonth(currentMonth);
  const today     = new Date();

  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ['calendar-events', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .order('date')
        .order('time');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recurringEvents, isLoading: loadingRecurring } = useQuery({
    queryKey: ['calendar-recurring-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('is_recurring', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: birthdays, isLoading: loadingBirthdays } = useQuery({
    queryKey: ['member-birthdays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, birth_date')
        .not('birth_date', 'is', null)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingEvent) {
        const { error } = await supabase
          .from('calendar_events').update(payload).eq('id', editingEvent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('calendar_events').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-recurring-events'] });
      toast.success(editingEvent ? 'Evento atualizado!' : 'Evento criado!');
      closeDialog();
    },
    onError: (error: any) => {
      toast.error('Erro ao salvar', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-recurring-events'] });
      toast.success('Evento excluído!');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir', { description: error.message });
    },
  });

  // ── Dialog helpers ───────────────────────────────────────────────────────
  function openNewDialog(date?: Date) {
    setEditingEvent(null);
    const d = date ?? new Date();
    setFormData({
      title: '', description: '', date: format(d, 'yyyy-MM-dd'),
      time: '', department: '', event_type: 'event',
      is_recurring: false, recurrence_day: String(getDay(d)), recurrence_year: null,
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(event: any) {
    setEditingEvent(event);
    setFormData({
      title:            event.title,
      description:      event.description || '',
      date:             event.date,
      time:             event.time || '',
      department:       event.department || '',
      event_type:       event.event_type,
      is_recurring:     !!event.is_recurring,
      recurrence_day:   event.recurrence_day != null ? String(event.recurrence_day) : '0',
      recurrence_year:  event.recurrence_year ?? null,
    });
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingEvent(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      title:            formData.title,
      description:      formData.description || null,
      date:             formData.date,
      time:             formData.time || null,
      department:       formData.department || null,
      event_type:       formData.event_type,
      is_recurring:     formData.is_recurring,
      recurrence_day:   formData.is_recurring ? Number(formData.recurrence_day) : null,
      recurrence_year:  formData.is_recurring ? formData.recurrence_year : null,
    });
  }

  // ── Navegação ────────────────────────────────────────────────────────────
  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth     = () => setCurrentMonth(addMonths(currentMonth, 1));
  const previousYear  = () => setCurrentMonth(setYear(currentMonth, getYear(currentMonth) - 1));
  const nextYear      = () => setCurrentMonth(setYear(currentMonth, getYear(currentMonth) + 1));
  const goToToday     = () => setCurrentMonth(new Date());

  // ── Helpers de dados ─────────────────────────────────────────────────────
  function getBirthdaysForDate(date: Date) {
    if (!birthdays) return [];
    const mm = format(date, 'MM');
    const dd = format(date, 'dd');
    return birthdays.filter((b: any) => {
      const bd = parseISO(b.birth_date);
      return format(bd, 'MM') === mm && format(bd, 'dd') === dd;
    });
  }

  function getEventsForDate(date: Date) {
    if (!events) return [];
    return events.filter((e: any) => isSameDay(parseISO(e.date), date));
  }

  function getRecurringForDate(date: Date) {
    if (!recurringEvents) return [];
    const dow  = getDay(date);
    const year = getYear(date);
    return recurringEvents.filter((e: any) => {
      if (Number(e.recurrence_day) !== dow) return false;
      if (e.recurrence_year != null && Number(e.recurrence_year) !== year) return false;
      return true;
    });
  }

  function getAllEventsForDateRaw(date: Date) {
    const direct    = getEventsForDate(date);
    const directIds = new Set(direct.map((e: any) => e.id));
    const recurring = getRecurringForDate(date).filter((e: any) => !directIds.has(e.id));
    return [...direct, ...recurring];
  }

  function getItemsForDate(date: Date) {
    let dayEvents  = getAllEventsForDateRaw(date);
    let dayBdays   = getBirthdaysForDate(date);

    if (activeFilter) {
      if (activeFilter === '__birthday__') {
        dayEvents = [];
      } else {
        dayBdays  = [];
        dayEvents = dayEvents.filter((e: any) => e.department === activeFilter);
      }
    }
    return { dayEvents, dayBdays };
  }

  const allMonthEvents = useMemo(() => {
    if (!events || !recurringEvents) return [];
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
    const all: any[] = [];
    daysInMonth.forEach(d => {
      const { dayEvents } = getItemsForDate(d);
      dayEvents.forEach(e => {
        const alreadyIn = all.find(x => x.id === e.id && isSameDay(parseISO(x.date), d));
        if (!alreadyIn) all.push({ ...e, date: format(d, 'yyyy-MM-dd') });
      });
    });
    return all.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  }, [events, recurringEvents, startDate, endDate, activeFilter]);

  const allMonthBirthdays = useMemo(() => {
    if (!birthdays) return [];
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });
    const all: any[] = [];
    daysInMonth.forEach(d => {
      const bdays = getBirthdaysForDate(d);
      bdays.forEach(b => all.push({ ...b, currentDay: d }));
    });
    return all;
  }, [birthdays, startDate, endDate]);

  function getCircleBgForDate(date: Date) {
    const { dayEvents, dayBdays } = getItemsForDate(date);
    if (dayBdays.length > 0) return BIRTHDAY_TAG.color;
    if (dayEvents.length > 0) {
      const deptId = dayEvents[0].department;
      const dept = departments?.find(d => d.id === deptId || d.name === deptId);
      return dept?.color || 'bg-gray-500';
    }
    return null;
  }

  const days = useMemo(() => {
    const startDow = getDay(startDate);
    const prevDays: Date[] = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(startDate);
      d.setDate(d.getDate() - (i + 1));
      prevDays.push(d);
    }
    const currentDays = eachDayOfInterval({ start: startDate, end: endDate });
    const nextDays: Date[] = [];
    const totalGrid = 42;
    const remaining = totalGrid - (prevDays.length + currentDays.length);
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(endDate);
      d.setDate(d.getDate() + i);
      nextDays.push(d);
    }
    return [...prevDays, ...currentDays, ...nextDays];
  }, [startDate, endDate]);

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* MAIN TABS */}
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-auto">
          <TabsList className="h-9">
            <TabsTrigger value="calendario" className="gap-2 text-sm px-4">
              <CalendarIcon className="h-4 w-4" /> 
              Calendário
            </TabsTrigger>
            <TabsTrigger value="servico" className="gap-2 text-sm px-4">
              <ClipboardList className="h-4 w-4" /> 
              Escala de Serviço
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {isAdmin && (
          <Button onClick={() => openNewDialog()} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> 
            <span>Novo</span>
          </Button>
        )}
      </div>

      {activeTab === 'calendario' ? (
        <>
          {/* CONTROLS */}
          <div className="flex flex-col gap-2 bg-card p-2 sm:p-1">
            <div className="flex items-center gap-2 w-full">

              {/* NAVEGAÇÃO DO MÊS */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={viewMode === 'year' ? previousYear : previousMonth}
                  className="h-8 w-8 flex items-center justify-center"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="outline"
                  className="
                    h-8 px-3
                    text-xs sm:text-sm font-semibold
                    min-w-[140px]
                    capitalize
                    flex items-center justify-center
                  "
                  onClick={() => setViewMode('year')}
                >
                  {viewMode === 'year' 
                    ? getYear(currentMonth)
                    : format(currentMonth, 'MMMM yyyy', { locale: ptBR })
                  }
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={viewMode === 'year' ? nextYear : nextMonth}
                  className="h-8 w-8 flex items-center justify-center"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* DIREITA — FILTRO + TABS */}
              <div className="ml-auto flex items-center gap-2">

                {/* Filtro de Departamentos */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 shrink-0" />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-8 min-w-[120px] flex items-center justify-between gap-2"
                      >
                        <span className="text-sm truncate">
                          {activeFilter === null
                            ? 'Todos'
                            : activeFilter === BIRTHDAY_TAG.value
                            ? BIRTHDAY_TAG.label
                            : departments?.find(d => d.id === activeFilter)?.name || 'Filtro'}
                        </span>
                        <ChevronRight className="h-3 w-3 rotate-90 shrink-0 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem onClick={() => setActiveFilter(null)}>
                        <span className={activeFilter === null ? 'font-semibold' : ''}>
                          Todos
                        </span>
                      </DropdownMenuItem>

                      {departments?.map(dept => (
                        <DropdownMenuItem
                          key={dept.id}
                          onClick={() => setActiveFilter(dept.id)}
                          className="flex items-center gap-2"
                        >
                          <div className={cn('w-3 h-3 rounded-full', dept.color)} />
                          <span className={activeFilter === dept.id ? 'font-semibold' : ''}>
                            {dept.name}
                          </span>
                        </DropdownMenuItem>
                      ))}

                      <DropdownMenuItem onClick={() => setActiveFilter(BIRTHDAY_TAG.value)}>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-3 h-3 rounded-full', BIRTHDAY_TAG.color)} />
                          <span className={activeFilter === BIRTHDAY_TAG.value ? 'font-semibold' : ''}>
                            {BIRTHDAY_TAG.label}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Tabs */}
                {activeTab === 'calendario' && (
                  <Tabs
                    value={viewMode}
                    onValueChange={(v: any) => setViewMode(v)}
                    className="w-auto"
                  >
                    <TabsList className="h-8 flex items-center">
                      <TabsTrigger
                        value="calendar"
                        className="
                          h-8 px-3 text-xs
                          flex items-center justify-center gap-1
                          data-[state=active]:h-7
                        "
                      >
                        <CalendarIcon className="h-3 w-3" />
                        <span className="hidden sm:inline">Mês</span>
                      </TabsTrigger>

                      <TabsTrigger
                        value="list"
                        className="
                          h-8 px-3 text-xs
                          flex items-center justify-center gap-1
                          data-[state=active]:h-7
                        "
                      >
                        <List className="h-3 w-3" />
                        <span className="hidden sm:inline">Lista</span>
                      </TabsTrigger>

                      <TabsTrigger
                        value="year"
                        className="
                          h-8 px-3 text-xs
                          flex items-center justify-center gap-1
                          data-[state=active]:h-7
                        "
                      >
                        <Church className="h-3 w-3" />
                        <span className="hidden sm:inline">Ano</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </div>
            </div>
          </div>

          {/* CALENDAR VIEW */}
          {viewMode === 'calendar' && (
            <Card className="border-none shadow-none bg-transparent">
              <CardContent className="p-0">
                {loadingEvents ? (
                  <div className="grid grid-cols-7 gap-px bg-muted border rounded-xl overflow-hidden">
                    {[...Array(42)].map((_, i) => <Skeleton key={i} className="h-24 sm:h-32 w-full rounded-none" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-px bg-muted border rounded-xl overflow-hidden shadow-sm">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                      <div key={d} className="bg-muted/50 p-2 sm:p-3 text-center font-bold text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground">{d}</div>
                    ))}
                    {days.map((day, i) => {
                      const { dayEvents, dayBdays } = getItemsForDate(day);
                      const isToday = isSameDay(day, today);
                      const isSelectedMonth = isSameMonth(day, currentMonth);

                      return (
                        <div
                          key={i}
                          className={cn(
                            'bg-background min-h-[80px] sm:min-h-[120px] p-1 sm:p-2 transition-all hover:bg-accent/30 group relative',
                            !isSelectedMonth && 'text-muted-foreground/40 bg-muted/5',
                            isToday && 'bg-primary/5'
                          )}
                          onClick={() => isAdmin && openNewDialog(day)}
                        >
                          <div className="flex justify-between items-start mb-1 sm:mb-2">
                            <span className={cn(
                              'text-xs sm:text-sm font-semibold h-6 w-6 sm:h-7 sm:w-7 flex items-center justify-center rounded-full transition-colors',
                              isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'group-hover:bg-muted'
                            )}>
                              {format(day, 'd')}
                            </span>
                          </div>

                          <div className="space-y-0.5 sm:space-y-1">
                            {dayBdays.slice(0, 1).map((b: any) => (
                              <div key={b.id} className="text-[9px] sm:text-xs bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded px-0.5 sm:px-1 py-0.5 truncate flex items-center gap-0.5 sm:gap-1">
                                <Cake className="h-2 w-2 sm:h-3 sm:w-3" />
                                <span className="truncate">{b.name}</span>
                              </div>
                            ))}

                            {dayEvents.slice(0, dayBdays.length > 0 ? 2 : 3).map((event: any) => {
                              const deptId = event.department;
                              const dept = departments?.find(d => d.id === deptId || d.name === deptId);
                              return (
                                <div
                                  key={event.id}
                                  className={cn('text-[9px] sm:text-xs rounded px-0.5 sm:px-1 py-0.5 truncate text-white flex items-center gap-0.5 sm:gap-1', dept?.color || 'bg-gray-500')}
                                  onClick={(e) => { e.stopPropagation(); if (isAdmin) openEditDialog(event); }}
                                >
                                  {event.is_recurring && <RotateCcw className="h-2 w-2 sm:h-3 sm:w-3 shrink-0 opacity-70" />}
                                  {event.time && <span className="font-semibold hidden sm:inline">{event.time.slice(0, 5)} </span>}
                                  <span className="truncate">{event.title}</span>
                                </div>
                              );
                            })}

                            {(dayEvents.length + dayBdays.length) > 3 && (
                              <div className="text-[8px] sm:text-xs text-muted-foreground font-semibold">
                                +{dayEvents.length + dayBdays.length - 3} eventos
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* YEAR VIEW */}
          {viewMode === 'year' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {MONTHS_PT.map((label, monthIndex) => {
                const monthDate  = setMonth(setYear(new Date(), getYear(currentMonth)), monthIndex);
                const mStart     = startOfMonth(monthDate);
                const mEnd       = endOfMonth(monthDate);
                const mDays      = eachDayOfInterval({ start: mStart, end: mEnd });
                const mStartDow  = getDay(mStart);
                const isCurrentM = isSameMonth(monthDate, today) && getYear(currentMonth) === getYear(today);

                const miniPrev: Date[] = [];
                for (let i = mStartDow - 1; i >= 0; i--) {
                  const d = new Date(mStart);
                  d.setDate(d.getDate() - (i + 1));
                  miniPrev.push(d);
                }
                const miniGrid = [...miniPrev, ...mDays];

                return (
                  <Card
                    key={monthIndex}
                    className={cn(
                      'cursor-pointer hover:shadow-md transition-shadow',
                      isCurrentM && 'ring-2 ring-primary',
                    )}
                    onClick={() => {
                      setCurrentMonth(monthDate);
                      setViewMode('calendar');
                    }}
                  >
                    <CardHeader className="py-2 px-3">
                      <CardTitle className={cn('text-sm text-center font-semibold capitalize', isCurrentM && 'text-primary')}>
                        {label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-2 pb-2">
                      <div className="grid grid-cols-7 gap-0.5">
                        {['D','S','T','Q','Q','S','S'].map((h, i) => (
                          <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground">{h}</div>
                        ))}

                        {miniGrid.map((day, i) => {
                          const isThisMonth = isSameMonth(day, monthDate);
                          const isDayToday  = isSameDay(day, today);
                          const circleBg    = isThisMonth ? getCircleBgForDate(day) : null;

                          return (
                            <div
                              key={i}
                              className={cn(
                                'h-5 flex items-center justify-center text-[10px] rounded-full',
                                !isThisMonth && 'opacity-30',
                                circleBg && circleBg,
                                circleBg && 'text-white font-semibold',
                                isDayToday && !circleBg && 'ring-2 ring-primary text-primary font-bold',
                                isDayToday && circleBg && 'ring-2 ring-white',
                              )}
                            >
                              {format(day, 'd')}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <div className="space-y-4">

              {/* ===== EVENTOS DO MÊS (AGRUPADOS POR DIA) ===== */}
              {loadingEvents ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : allMonthEvents.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground">
                  Nenhum evento neste mês
                </p>
              ) : (
                Object.entries(
                  allMonthEvents.reduce((acc: any, event: any) => {
                    if (!event.date) return acc;
                    try {
                      const key = format(parseISO(event.date), 'yyyy-MM-dd')
                      if (!acc[key]) acc[key] = []
                      acc[key].push(event)
                    } catch (e) {
                      console.error("Erro ao processar data do evento:", event);
                    }
                    return acc
                  }, {})
                ).map(([day, events]: any) => {
                  let date;
                  try {
                    date = parseISO(day);
                  } catch (e) {
                    return null;
                  }

                  // LÓGICA PARA VERIFICAR SE O DIA INTEIRO JÁ PASSOU
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  
                  const eventDateOnly = new Date(date);
                  eventDateOnly.setHours(0, 0, 0, 0);

                  const isPastDay = isBefore(eventDateOnly, today);

                  return (
                    <div 
                      key={day} 
                      className={cn(
                        "space-y-2 transition-all duration-300",
                        isPastDay && "opacity-50 grayscale-[0.5]"
                      )}
                    >

                      {/* CABEÇALHO DO DIA */}
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm transition-colors",
                          isPastDay ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                        )}>
                          {format(date, 'dd')}
                        </div>

                        <div>
                          <p className="font-semibold capitalize">
                            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                          </p>
                          <p className="text-sm text-muted-foreground leading-none">
                            {events.length} evento{events.length > 1 && 's'}
                          </p>
                        </div>
                      </div>

                      {/* EVENTOS DO DIA */}
                      <div className="space-y-2 pl-11">
                        {events.map((event: any) => {
                          const dept = departments?.find(
                            d => d.id === event.department || d.name === event.department
                          )

                          let isPastEvent = isPastDay;
                          if (!isPastDay && isSameDay(eventDateOnly, today) && event.time) {
                            const now = new Date();
                            const [hours, minutes] = event.time.split(':').map(Number);
                            const eventTime = new Date();
                            eventTime.setHours(hours, minutes, 0, 0);
                            isPastEvent = isBefore(eventTime, now);
                          }

                          return (
                            <div
                              key={event.id}
                              className={cn(
                                "relative rounded-xl border bg-background p-3",
                                !isPastDay && isPastEvent && "opacity-60"
                              )}
                            >
                              {/* BARRA LATERAL */}
                              <div
                                className={cn(
                                  'absolute left-0 top-3 h-10 w-1 rounded-full',
                                  dept?.color || 'bg-gray-400'
                                )}
                              />

                              {/* TÍTULO */}
                              <h3 className="font-semibold flex items-center gap-2">
                                {event.title}
                                {isPastEvent && (
                                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase font-bold">
                                    Encerrado
                                  </span>
                                )}
                              </h3>

                              {/* DESCRIÇÃO */}
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {event.description}
                                </p>
                              )}

                              {/* META */}
                              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                                {event.time && <span>{event.time.slice(0, 5)}</span>}
                                {event.location && <span>{event.location}</span>}
                                {event.is_recurring && <span>Semanal</span>}
                              </div>

                              {/* BADGE */}
                              <Badge variant="outline" className="mt-2">
                                {dept?.name || 'Geral'}
                              </Badge>

                              {/* AÇÕES ADMIN */}
                              {isAdmin && (
                                <div className="absolute top-2 right-2 flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(event)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteMutation.mutate(event.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

        </>
      ) : (
        /* ABA ESCALA DE SERVIÇO */
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
              <Church className="h-6 w-6" />
              Escala de Serviço
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Organização e distribuição das responsabilidades</p>
          </div>

          {/* Cards de Estatísticas */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Total de Escalas no Mês */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Escalas no Mês</CardTitle>
                <CalendarIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">8</div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">4 Cultos • 4 Limpezas</p>
              </CardContent>
            </Card>

            {/* Limpeza */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Limpeza</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 12h4"/><path d="M4 6v14c0 1 1 2 2 2h12c1 0 2-1 2-2V6"/>
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700 dark:text-green-300">12</div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Pessoas escaladas</p>
              </CardContent>
            </Card>

            {/* Intercessão */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Intercessão</CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">14</div>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Pessoas escaladas</p>
              </CardContent>
            </Card>
          </div>

          {/* Próximo Evento - Destaque */}
          <Card className="border-2 border-primary/30 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  Próximo Culto
                </CardTitle>
                <Badge variant="default" className="bg-primary">Domingo, 08/fev</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6">
                {/* Portaria */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>
                    </svg>
                    Portaria
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Diac. Saulo</p>
                  </div>
                </div>

                {/* Intercessão */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                    </svg>
                    Intercessão
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 space-y-1">
                    <p className="font-medium text-purple-900 dark:text-purple-100">Diac. Aline</p>
                    <p className="font-medium text-purple-900 dark:text-purple-100">Diac. Ana Angélica</p>
                  </div>
                </div>

                {/* Dirigente */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    <Church className="h-4 w-4" />
                    Dirigente
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
                    <p className="font-medium text-green-900 dark:text-green-100">Pr Felipe</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Escala do Mês - Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Escala Completa de Fevereiro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Domingo 01/fev */}
                <div className="relative pl-8 pb-8 border-l-2 border-muted">
                  <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-red-500 border-4 border-background" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Domingo</Badge>
                      <span className="font-semibold">01/fev - Culto</span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Portaria</p>
                        <p className="text-sm font-medium">Diac. Walmir</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Intercessão</p>
                        <p className="text-sm font-medium">Diac. Rafael, Diac Hendy</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Dirigente</p>
                        <p className="text-sm font-medium">Pr Glauco</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Terça 03/fev */}
                <div className="relative pl-8 pb-8 border-l-2 border-muted">
                  <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-blue-500 border-4 border-background" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Terça-feira</Badge>
                      <span className="font-semibold">03/fev - Culto</span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Portaria</p>
                        <p className="text-sm font-medium">Diácono Rafael</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Intercessão</p>
                        <p className="text-sm font-medium">Mayara, Diac. Aline</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground mb-1">Dirigente</p>
                        <p className="text-sm font-medium">Diac Suzana</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sábado 07/fev - Limpeza */}
                <div className="relative pl-8 pb-8 border-l-2 border-muted">
                  <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-green-500 border-4 border-background" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Sábado</Badge>
                      <span className="font-semibold">07/fev - Limpeza</span>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/30 rounded-md p-3">
                      <p className="text-xs text-muted-foreground mb-1">Responsáveis</p>
                      <p className="text-sm font-medium">Aline, Rafael, Ana Angelica</p>
                    </div>
                  </div>
                </div>

                {/* Domingo 08/fev - ATIVO/PRÓXIMO */}
                <div className="relative pl-8 pb-8 border-l-2 border-primary">
                  <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary border-4 border-background shadow-lg shadow-primary/50" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary">Domingo</Badge>
                      <span className="font-semibold">08/fev - Culto</span>
                      <Badge variant="outline" className="ml-auto">Próximo</Badge>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="bg-primary/10 rounded-md p-2 border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Portaria</p>
                        <p className="text-sm font-medium">Diac. Saulo</p>
                      </div>
                      <div className="bg-primary/10 rounded-md p-2 border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Intercessão</p>
                        <p className="text-sm font-medium">Diac. Aline, Diac. Ana Angélica</p>
                      </div>
                      <div className="bg-primary/10 rounded-md p-2 border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Dirigente</p>
                        <p className="text-sm font-medium">Pr Felipe</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Indicador de mais eventos */}
                <div className="relative pl-8">
                  <div className="absolute -left-[9px] top-2 h-4 w-4 rounded-full bg-muted border-4 border-background" />
                  <p className="text-sm text-muted-foreground italic">+ eventos restantes no mês...</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
            <DialogDescription>
              {editingEvent ? 'Atualize as informações do evento' : 'Crie um novo evento no calendário'}
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Titulo do Evento */}
            <div className="space-y-2">
              <Label>Titulo do Evento *</Label>
              <Input
                placeholder="Nome do evento"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            {/* Descricao */}
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                placeholder="Detalhes do evento"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/*Data, Inicio e Termino */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
                disabled={formData.is_recurring}
              />
            </div>
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Termino</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            {/* Departamento e Local */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={formData.department} onValueChange={v => setFormData({ ...formData, department: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-3 h-3 rounded-full', dept.color)} />
                            {dept.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                <Label>Local</Label>
                <Input
                  placeholder="Local do evento"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>

            {/* Recorrencia */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select 
                  value={formData.recurrence_type || (formData.is_recurring ? 'weekly' : 'none')} 
                  onValueChange={v => {
                    const isRecurring = v !== 'none';
                    
                    const detectedDayOfWeek = isRecurring && formData.date 
                      ? String(getDay(parseISO(formData.date))) 
                      : null;

                    setFormData({ 
                      ...formData, 
                      is_recurring: isRecurring, 
                      recurrence_type: v,
                      recurrence_day: detectedDayOfWeek,
                      recurrence_year: isRecurring ? (formData.recurrence_year || getYear(new Date())) : null 
                    });
                  }}
                >
                  <SelectTrigger className="w-full bg-muted/40">
                    <div className="flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Selecione a recorrência" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não Repete</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.is_recurring && (
                <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Repetir apenas em {formData.recurrence_year || getYear(new Date())}</span>
                      <span className="text-xs text-muted-foreground">O evento não aparecerá em anos futuros</span>
                    </div>
                  </div>
                  <Switch
                    checked={formData.recurrence_year !== null}
                    onCheckedChange={checked =>
                      setFormData({ ...formData, recurrence_year: checked ? getYear(new Date()) : null })
                    }
                  />
                </div>
              )}
            </div>
        
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando…</>
                ) : 'Salvar'}
              </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
);
}
