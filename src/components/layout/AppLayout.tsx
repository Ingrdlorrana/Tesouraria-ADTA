import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
  Church,
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  FileBarChart,
  HeartHandshake,
  Settings,
  LogOut,
  Menu,
  Shield,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Entradas', href: '/entradas', icon: ArrowDownCircle },
  { name: 'Saídas', href: '/saidas', icon: ArrowUpCircle },
  { name: 'Ação Social', href: '/acaosocial', icon: HeartHandshake },
  { name: 'Membros', href: '/membros', icon: Users },
  { name: 'Relatórios', href: '/relatorios', icon: FileBarChart },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
];

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, isAdmin, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onClick}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-card lg:block">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center">
          <div className="p-3 rounded-lg">
            <img src="/ADTA.svg" alt="Logo da Igreja" className="h-10 w-10" />
          </div>
            <span className="font-bold text-lg">Tesouraria</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            <NavLinks />
          </nav>

          {/* User Info */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {profile?.name ? getInitials(profile.name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.name}</p>
                <div className="flex items-center gap-1">
                  {isAdmin && <Shield className="h-3 w-3 text-primary" />}
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? 'Administrador' : 'Visualizador'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="fixed top-0 z-40 flex h-16 w-full items-center justify-between border-b bg-card px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-16 items-center">
                <div className="p-2 rounded-lg">
                <div className="p-3 rounded-lg">
                  <img src="/ADTA.svg" alt="Logo da Igreja" className="h-10 w-10" />
                </div>
                </div>
                <span className="font-bold text-lg">Tesouraria</span>
              </div>
              <nav className="flex-1 space-y-1 p-4">
                <NavLinks onClick={() => setMobileMenuOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
          <div className="p-3 rounded-lg">
            <img src="/ADTA.svg" alt="Logo da Igreja" className="h-10 w-10" />
          </div>
            <span className="font-bold">Tesouraria</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {profile?.name ? getInitials(profile.name) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{profile?.name}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="min-h-screen pt-16 lg:pt-0">
          <div className="p-4 lg:p-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
