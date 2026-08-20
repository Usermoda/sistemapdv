import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, LayoutDashboard, ShoppingCart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export function FinishStep() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(true);

  useEffect(() => {
    api.setup
      .complete()
      .then(() => setSaving(false))
      .catch((e) => {
        toast.error(`Erro ao finalizar: ${(e as Error).message}`);
        setSaving(false);
      });
  }, []);

  return (
    <div className="space-y-10 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-success/20 to-success/40 flex items-center justify-center"
      >
        <CheckCircle2 className="w-12 h-12 text-success" />
      </motion.div>

      <div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/30 mb-4"
        >
          <Sparkles className="w-3.5 h-3.5 text-success" />
          <span className="text-xs font-medium text-success">Instalação completa</span>
        </motion.div>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-3">
          Tudo pronto!
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Seu sistema está configurado. Você pode acessar o painel administrativo (ERP) ou abrir direto o PDV de vendas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto pt-6">
        <motion.button
          whileHover={{ y: -4 }}
          onClick={() => navigate('/erp')}
          disabled={saving}
          className="p-8 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/50 transition-all text-left group"
        >
          <LayoutDashboard className="w-8 h-8 text-primary mb-4" />
          <h3 className="text-lg font-semibold mb-1">Painel ERP</h3>
          <p className="text-sm text-muted-foreground">
            Cadastros, estoque, financeiro, relatórios e configurações gerais.
          </p>
        </motion.button>

        <motion.button
          whileHover={{ y: -4 }}
          onClick={() => navigate('/pdv')}
          disabled={saving}
          className="p-8 rounded-2xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20 hover:border-success/50 transition-all text-left"
        >
          <ShoppingCart className="w-8 h-8 text-success mb-4" />
          <h3 className="text-lg font-semibold mb-1">Abrir PDV</h3>
          <p className="text-sm text-muted-foreground">
            Tela de vendas otimizada para touch — pronta para atender clientes.
          </p>
        </motion.button>
      </div>

      <div className="pt-6">
        <Button variant="ghost" onClick={() => navigate('/erp')} disabled={saving}>
          Ir para o sistema
        </Button>
      </div>
    </div>
  );
}
