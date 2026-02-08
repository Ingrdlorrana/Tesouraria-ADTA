import { useAuth } from '@/contexts/AuthContext';

export default function WelcomeHeader() {
  const { profile } = useAuth();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        Bem-vindo (a), {profile?.name?.split(' ')[0] || 'Usuário'}
      </h1>
      <p className="text-muted-foreground mt-1">
        Aqui está o resumo das atividades da ADTA
      </p>
    </div>
  );
}
