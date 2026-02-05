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
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Calendário</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Eventos e aniversariantes</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="hidden md:block">
            <TabsList>
              <TabsTrigger value="calendar" className="gap-2"><CalendarIcon className="h-4 w-4" /> Grade</TabsTrigger>
              <TabsTrigger value="list" className="gap-2"><List className="h-4 w-4" /> Lista</TabsTrigger>
              <TabsTrigger value="year" className="gap-2"><Church className="h-4 w-4" /> Ano</TabsTrigger>
            </TabsList>
          </Tabs>
          {isAdmin && (
            <Button onClick={() => openNewDialog()} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Evento</span>
            </Button>
          )}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-card p-3 sm:p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" onClick={previousMonth} className="h-8 w-8 sm:h-10 sm:w-10"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" className="h-8 sm:h-10 px-2 sm:px-4 text-sm sm:text-base font-semibold min-w-[120px] sm:min-w-[160px] capitalize" onClick={() => setViewMode('year')}>
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </Button>
            <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8 sm:h-10 sm:w-10"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="ghost" size="sm" onClick={goToToday} className="text-primary hover:text-primary hover:bg-primary/10 gap-1 sm:gap-2">
            <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" /> Hoje
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full lg:w-auto">
          <Button variant={activeFilter === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setActiveFilter(null)} className="h-7 sm:h-8 text-[10px] sm:text-xs">Todos</Button>
          {departments?.map(dept => (
            <Button
              key={dept.id}
              variant={activeFilter === dept.id ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setActiveFilter(dept.id)}
              className="h-7 sm:h-8 text-[10px] sm:text-xs gap-1.5"
            >
              <div className={cn('w-2 h-2 rounded-full', dept.color)} />
              {dept.name}
            </Button>
          ))}
          <Button
            variant={activeFilter === BIRTHDAY_TAG.value ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter(BIRTHDAY_TAG.value)}
            className="h-7 sm:h-8 text-[10px] sm:text-xs gap-1.5"
          >
            <div className={cn('w-2 h-2 rounded-full', BIRTHDAY_TAG.color)} />
            {BIRTHDAY_TAG.label}
          </Button>
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

                        {dayEvents.slice(0, 1).map((event: any) => {
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

                        {(dayEvents.length + dayBdays.length) > 2 && (
                          <div className="text-[8px] sm:text-xs text-muted-foreground">+{dayEvents.length + dayBdays.length - 2}</div>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Church className="h-5 w-5" />
                Eventos do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : allMonthEvents.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum evento neste mês</p>
              ) : (
                <div className="space-y-2">
                  {allMonthEvents.map((event: any) => {
                    const deptId = event.department;
                    const dept = departments?.find(d => d.id === deptId || d.name === deptId);
                    return (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn('text-white', dept?.color || 'bg-gray-500')}>{dept?.name || 'Geral'}</Badge>
                            {event.is_recurring && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <RotateCcw className="h-3 w-3" />
                                Semanal
                                {event.recurrence_year && <><Lock className="h-3 w-3" />{event.recurrence_year}</>}
                              </Badge>
                            )}
                            <h3 className="font-semibold">{event.title}</h3>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {format(parseISO(event.date), "dd/MM/yyyy', ' EEEE", { locale: ptBR })}
                            {event.time && ` às ${event.time.slice(0, 5)}`}
                          </div>
                          {event.description && <p className="text-sm text-muted-foreground mt-1">{event.description}</p>}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(event)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(event.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-blue-500" />
                Eventos Recorrentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRecurring ? (
                <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              ) : !recurringEvents || recurringEvents.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum evento recorrente cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {recurringEvents.map((event: any) => {
                    const deptId = event.department;
                    const dept = departments?.find(d => d.id === deptId || d.name === deptId);
                    const dayName = DAYS_OF_WEEK.find(d => d.value === String(event.recurrence_day))?.label;
                    return (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn('text-white', dept?.color || 'bg-gray-500')}>{dept?.name || 'Geral'}</Badge>
                            <Badge variant="outline" className="text-xs">
                              {dayName} {event.time ? `às ${event.time.slice(0,5)}` : ''}
                            </Badge>
                            {event.recurrence_year && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Lock className="h-3 w-3" />
                                Ano {event.recurrence_year}
                              </Badge>
                            )}
                            <h3 className="font-semibold">{event.title}</h3>
                          </div>
                          {event.description && <p className="text-sm text-muted-foreground mt-1">{event.description}</p>}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(event)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(event.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cake className="h-5 w-5 text-pink-500" />
                Aniversariantes do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBirthdays ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : allMonthBirthdays.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum aniversariante neste mês</p>
              ) : (
                <div className="space-y-2">
                  {allMonthBirthdays
                    .sort((a: any, b: any) =>
                      parseInt(format(parseISO(a.birth_date), 'dd')) - parseInt(format(parseISO(b.birth_date), 'dd'))
                    )
                    .map((bday: any) => (
                      <div key={bday.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="bg-pink-100 dark:bg-pink-900/30 p-2 rounded-full">
                            <Cake className="h-5 w-5 text-pink-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{bday.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(bday.birth_date), "dd 'de' MMMM", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
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
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Nome do evento"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-lg px-3 py-2.5 bg-muted/40">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recorrência semanal</span>
              </div>
              <Switch
                checked={formData.is_recurring}
                onCheckedChange={checked => {
                  const dow = checked ? String(getDay(parseISO(formData.date))) : formData.recurrence_day;
                  setFormData({ ...formData, is_recurring: checked, recurrence_day: dow, recurrence_year: null });
                }}
              />
            </div>

            {formData.is_recurring && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                <div className="space-y-2">
                  <Label className="text-sm">Dia da semana *</Label>
                  <Select value={formData.recurrence_day} onValueChange={v => setFormData({ ...formData, recurrence_day: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Travar em um ano</span>
                  </div>
                  <Switch
                    checked={formData.recurrence_year !== null}
                    onCheckedChange={checked =>
                      setFormData({ ...formData, recurrence_year: checked ? getYear(new Date()) : null })
                    }
                  />
                </div>

                {formData.recurrence_year !== null && (
                  <div className="space-y-2">
                    <Label className="text-sm">Ano</Label>
                    <Select
                      value={String(formData.recurrence_year)}
                      onValueChange={v => setFormData({ ...formData, recurrence_year: Number(v) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 8 }, (_, i) => getYear(new Date()) - 2 + i).map(year => (
                          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

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
              <Label>Descrição</Label>
              <Textarea
                placeholder="Detalhes do evento"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
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
