import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AlertTriangle, Check, Database, Building2, Printer, Sparkles, Users, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, isElectron } from '@/lib/api';
import { BipaMark, BipaWordmark } from '@/components/BipaLogo';
import { WelcomeStep } from './steps/WelcomeStep';
import { DatabaseStep } from './steps/DatabaseStep';
import { CompanyStep } from './steps/CompanyStep';
import { PrinterStep } from './steps/PrinterStep';
import { PaymentMethodsStep } from './steps/PaymentMethodsStep';
import { UsersStep } from './steps/UsersStep';
import { FinishStep } from './steps/FinishStep';

const SERVER_STEPS = [
  { path: 'welcome', label: 'Boas-vindas', icon: Sparkles },
  { path: 'database', label: 'Banco de Dados', icon: Database },
  { path: 'company', label: 'Empresa', icon: Building2 },
  { path: 'printer', label: 'Impressora', icon: Printer },
  { path: 'payments', label: 'Pagamentos', icon: Wallet },
  { path: 'users', label: 'Usuários', icon: Users },
  { path: 'finish', label: 'Concluir', icon: Check },
];

// No modo terminal, os cadastros de Empresa/Pagamentos/Usuários já existem no
// servidor compartilhado — pulamos essas etapas.
const TERMINAL_STEPS = [
  { path: 'welcome', label: 'Boas-vindas', icon: Sparkles },
  { path: 'database', label: 'Servidor', icon: Database },
  { path: 'printer', label: 'Impressora', icon: Printer },
  { path: 'finish', label: 'Concluir', icon: Check },
];

export function SetupWizard() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.split('/').pop() ?? 'welcome';
  const [mode, setMode] = useState<'server' | 'terminal'>('server');

  useEffect(() => {
    if (!isElectron()) return;
    void api.getSetupStatus().then((s) => setMode(s.mode));
    // Re-checa quando a rota muda (o usuário pode ter escolhido o modo no DatabaseStep)
  }, [currentPath]);

  const steps = mode === 'terminal' ? TERMINAL_STEPS : SERVER_STEPS;
  const currentIndex = Math.max(0, steps.findIndex((s) => s.path === currentPath));

  useEffect(() => {
    if (currentPath === 'setup') navigate('/setup/welcome', { replace: true });
  }, [currentPath, navigate]);

  if (!isElectron()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-xl font-semibold">Ambiente incorreto</h1>
          <p className="text-sm text-muted-foreground">
            Este app deve ser aberto pela janela do Electron. Rode <code className="bg-black/40 px-1.5 py-0.5 rounded">npm run dev</code> e aguarde a janela abrir automaticamente (não abra pelo navegador).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex">
      <aside className="hidden md:flex w-80 flex-col border-r border-white/5 bg-black/20 backdrop-blur-md">
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center gap-3">
            <BipaMark size={40} />
            <div>
              <BipaWordmark className="text-lg" />
              <p className="text-xs text-muted-foreground">Assistente de Instalação</p>
            </div>
          </div>
        </div>
        <nav className="p-4 flex-1">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentIndex;
            const isDone = idx < currentIndex;
            return (
              <div
                key={step.path}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all',
                  isActive && 'bg-primary/10 text-primary',
                  isDone && 'text-muted-foreground'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                    isActive && 'border-primary bg-primary/10',
                    isDone && 'border-success bg-success text-success-foreground',
                    !isActive && !isDone && 'border-white/10 text-muted-foreground'
                  )}
                >
                  {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{step.label}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Etapa {idx + 1}</div>
                </div>
              </div>
            );
          })}
        </nav>
        <div className="p-6 border-t border-white/5 text-xs text-muted-foreground">
          Após a instalação, o sistema estará pronto para uso em qualquer terminal PDV.
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="h-1 bg-black/30">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPath}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              className="max-w-3xl mx-auto p-8 lg:p-12"
            >
              <Routes>
                <Route path="welcome" element={<WelcomeStep onNext={() => navigate('/setup/database')} />} />
                <Route
                  path="database"
                  element={
                    <DatabaseStep
                      onNext={() => navigate(mode === 'terminal' ? '/setup/printer' : '/setup/company')}
                      onBack={() => navigate('/setup/welcome')}
                    />
                  }
                />
                <Route path="company" element={<CompanyStep onNext={() => navigate('/setup/printer')} onBack={() => navigate('/setup/database')} />} />
                <Route
                  path="printer"
                  element={
                    <PrinterStep
                      onNext={() => navigate(mode === 'terminal' ? '/setup/finish' : '/setup/payments')}
                      onBack={() => navigate(mode === 'terminal' ? '/setup/database' : '/setup/company')}
                    />
                  }
                />
                <Route path="payments" element={<PaymentMethodsStep onNext={() => navigate('/setup/users')} onBack={() => navigate('/setup/printer')} />} />
                <Route path="users" element={<UsersStep onNext={() => navigate('/setup/finish')} onBack={() => navigate('/setup/payments')} />} />
                <Route path="finish" element={<FinishStep />} />
                <Route path="*" element={<Navigate to="/setup/welcome" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
