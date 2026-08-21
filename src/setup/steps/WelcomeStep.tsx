import { motion } from 'framer-motion';
import { ArrowRight, Database, Printer, ShoppingCart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  { icon: Database, title: 'Banco MySQL', desc: 'Estrutura completa, moderna e otimizada para varejo.' },
  { icon: ShoppingCart, title: 'PDV Touch', desc: 'Interface preparada para telas sensíveis ao toque.' },
  { icon: Printer, title: 'Impressora Térmica', desc: 'Cupons, comprovantes, gaveta e balança integrados.' },
];

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-10">
      <div>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Bem-vindo ao Bipa</span>
        </motion.div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
          Vamos preparar seu <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">sistema de vendas</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Em poucos passos, deixamos tudo pronto: banco de dados, cadastro do seu comércio e os equipamentos que você usa no dia a dia.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="p-5 rounded-xl bg-card/50 border border-white/5 hover:border-primary/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4">
        <Button size="xl" onClick={onNext}>
          Começar instalação
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
