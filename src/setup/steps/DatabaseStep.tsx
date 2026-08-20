import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { api, type ConnectionConfig } from '@/lib/api';
import { toast } from 'sonner';

type Detection = {
  installed: boolean;
  running: boolean;
  port: number;
  version?: string;
  bundled?: boolean;
  canAutoInstall?: boolean;
  hint?: string;
};

type BundledProgress = { phase: 'download' | 'extract' | 'init' | 'start'; msg: string; pct: number } | null;

export function DatabaseStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [detection, setDetection] = useState<Detection | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [cfg, setCfg] = useState<ConnectionConfig>({ host: '127.0.0.1', port: 3306, user: 'root', password: '' });
  const [dbName, setDbName] = useState('sistema_pdv');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<{ msg: string; pct: number } | null>(null);
  const [installed, setInstalled] = useState(false);

  const [autoInstalling, setAutoInstalling] = useState(false);
  const [autoProgress, setAutoProgress] = useState<BundledProgress>(null);

  useEffect(() => {
    void runDetection();
    const offSchema = api.db.onInstallProgress((p) => setProgress(p));
    const offBundled = api.db.onInstallBundledProgress((u) => setAutoProgress(u));
    return () => {
      offSchema();
      offBundled();
    };
  }, []);

  const runDetection = async () => {
    setDetecting(true);
    try {
      const d = await api.db.detect(cfg.port);
      setDetection(d);
    } catch (e) {
      toast.error(`Falha ao detectar MySQL: ${(e as Error).message}`);
    }
    setDetecting(false);
  };

  const handleAutoInstall = async () => {
    setAutoInstalling(true);
    setAutoProgress({ phase: 'download', msg: 'Iniciando...', pct: 0 });
    try {
      const r = await api.db.installBundled();
      if (r.ok) {
        const chosenPort = r.port ?? 3306;
        toast.success(`MariaDB instalado na porta ${chosenPort}`);
        const nextCfg = { host: '127.0.0.1', port: chosenPort, user: 'root', password: '' };
        setCfg(nextCfg);
        await runDetection();
        const test = await api.db.test(nextCfg);
        setTestResult({
          ok: test.ok,
          message: test.ok ? `Conectado — ${test.version ?? 'MariaDB'}` : test.error ?? 'Erro',
        });
      } else {
        toast.error(`Falha na instalação: ${r.error}`);
      }
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    setAutoInstalling(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await api.db.test(cfg);
    if (r.ok && r.innodb === false) {
      setTestResult({
        ok: true,
        message: `Conectado — MySQL ${r.version ?? ''} (⚠ InnoDB desativado: será usado o MariaDB portable ao instalar)`,
      });
    } else {
      setTestResult({ ok: r.ok, message: r.ok ? `Conectado — MySQL ${r.version ?? ''}` : r.error ?? 'Erro ao conectar' });
    }
    setTesting(false);
  };

  const handleInstallSchema = async () => {
    setInstalling(true);
    setProgress({ msg: 'Verificando servidor...', pct: 0 });
    try {
      let effectiveCfg = cfg;

      // 1) Confirma conexão e disponibilidade do InnoDB (o PDV exige InnoDB).
      const test = await api.db.test(cfg);
      if (!test.ok) throw new Error(test.error ?? 'Falha ao conectar no servidor informado');

      // 2) Servidor sem InnoDB (ex.: MySQL com skip-innodb) → provisiona o
      //    MariaDB portable automaticamente e passa a usá-lo, sem intervenção manual.
      if (test.innodb === false) {
        toast.warning('Servidor sem InnoDB — instalando o MariaDB portable automaticamente...');
        setInstalling(false);
        setAutoInstalling(true);
        setAutoProgress({ phase: 'download', msg: 'Preparando MariaDB portable...', pct: 0 });
        const r = await api.db.installBundled();
        setAutoInstalling(false);
        if (!r.ok) throw new Error(`Falha ao instalar o MariaDB portable: ${r.error}`);
        effectiveCfg = { host: '127.0.0.1', port: r.port ?? 3306, user: 'root', password: '' };
        setCfg(effectiveCfg);
        await runDetection();
        toast.success(`MariaDB portable pronto na porta ${effectiveCfg.port} (com InnoDB)`);
        setInstalling(true);
      }

      // 3) Cria o banco e instala a estrutura no servidor efetivo (InnoDB garantido).
      setProgress({ msg: 'Criando banco de dados...', pct: 5 });
      await api.db.createDatabase(effectiveCfg, dbName);
      setProgress({ msg: 'Instalando estrutura...', pct: 10 });
      await api.db.installSchema(effectiveCfg, dbName);
      await api.db.saveConfig({ ...effectiveCfg, database: dbName });
      setInstalled(true);
      toast.success('Banco de dados instalado com sucesso!');
    } catch (e) {
      toast.error(`Erro na instalação: ${(e as Error).message}`);
    } finally {
      setInstalling(false);
      setAutoInstalling(false);
    }
  };

  const showAutoInstall =
    !!detection &&
    !detection.installed &&
    !!detection.canAutoInstall &&
    !autoInstalling &&
    !autoProgress;

  const showInstallProgress = autoInstalling || (!!autoProgress && !detection?.bundled);

  // Derive a clear, single-source-of-truth status
  const status: 'checking' | 'installed-running' | 'installed-stopped' | 'port-conflict' | 'not-installed' = detecting
    ? 'checking'
    : !detection
    ? 'checking'
    : detection.installed && detection.running
    ? 'installed-running'
    : detection.installed && !detection.running
    ? 'installed-stopped'
    : !detection.installed && detection.running
    ? 'port-conflict'
    : 'not-installed';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Banco de Dados MySQL</h1>
        <p className="text-muted-foreground">Vamos detectar o servidor MySQL, criar o banco e instalar toda a estrutura do sistema.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/5 bg-card/50 p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Status do MySQL</h3>
              <p className="text-xs text-muted-foreground">Detecção automática do servidor local</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={runDetection} disabled={detecting || autoInstalling}>
            <RefreshCw className={detecting ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
          </Button>
        </div>

        {status === 'checking' ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando servidor na porta {cfg.port}...
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {status === 'installed-running' && (
              <>
                <StatusRow
                  variant="ok"
                  label={detection?.bundled ? 'MariaDB portable instalado' : 'MySQL/MariaDB instalado'}
                  detail={detection?.version}
                />
                <StatusRow variant="ok" label={`Serviço rodando na porta ${detection?.port}`} />
              </>
            )}
            {status === 'installed-stopped' && (
              <>
                <StatusRow
                  variant="ok"
                  label={detection?.bundled ? 'MariaDB portable instalado' : 'MySQL/MariaDB instalado'}
                  detail={detection?.version}
                />
                <StatusRow variant="warn" label="Serviço não está rodando" />
              </>
            )}
            {status === 'not-installed' && (
              <>
                <StatusRow variant="warn" label="Nenhum servidor MySQL detectado" />
                <StatusRow variant="warn" label={`Porta ${detection?.port} livre`} detail="pronto para instalar" />
              </>
            )}
            {status === 'port-conflict' && (
              <>
                <StatusRow variant="warn" label="Nenhum MySQL/MariaDB instalado" />
                <StatusRow
                  variant="error"
                  label={`Porta ${detection?.port} está em uso por outro processo`}
                  detail="conflito"
                />
                <div className="mt-3 flex gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-destructive" />
                  <div className="text-xs">
                    <p className="text-foreground/90">
                      Algo está usando a porta {detection?.port} mas não conseguimos identificar como MySQL.
                      Feche o processo conflitante ou escolha outra porta para instalar.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>

      {showAutoInstall && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Instalação automática disponível</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Podemos baixar e configurar o MariaDB automaticamente (~90 MB). Portable, não requer permissões de administrador, roda apenas para este sistema.
              </p>
              <div className="flex gap-3">
                <Button size="lg" onClick={handleAutoInstall}>
                  <Download className="w-4 h-4" />
                  Instalar automaticamente
                </Button>
                <a
                  href="https://dev.mysql.com/downloads/installer/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors self-center"
                >
                  Ou instalar manualmente <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {showInstallProgress && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/5 bg-card/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Instalando MariaDB...</h3>
              <p className="text-xs text-muted-foreground">Não feche o app durante a instalação</p>
            </div>
            <span className="text-sm text-muted-foreground">{autoProgress?.pct ?? 0}%</span>
          </div>
          <Progress value={autoProgress?.pct ?? 0} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {autoInstalling && <Loader2 className="w-3 h-3 animate-spin" />}
            {autoProgress?.msg}
          </div>
          <div className="flex gap-1 pt-1">
            {(['download', 'extract', 'init', 'start'] as const).map((phase) => {
              const currentIdx = ['download', 'extract', 'init', 'start'].indexOf(autoProgress?.phase ?? 'download');
              const idx = ['download', 'extract', 'init', 'start'].indexOf(phase);
              const active = idx <= currentIdx;
              const label = { download: 'Baixar', extract: 'Extrair', init: 'Inicializar', start: 'Iniciar' }[phase];
              return (
                <div key={phase} className="flex-1">
                  <div className={`h-1 rounded-full ${active ? 'bg-primary' : 'bg-white/10'}`} />
                  <div className={`text-[10px] uppercase tracking-wider mt-1 text-center ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="rounded-xl border border-white/5 bg-card/50 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Conexão</h3>
            <p className="text-xs text-muted-foreground">Credenciais do servidor MySQL</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Host</Label>
            <Input value={cfg.host} onChange={(e) => setCfg({ ...cfg, host: e.target.value })} placeholder="127.0.0.1" />
          </div>
          <div className="space-y-1.5">
            <Label>Porta</Label>
            <Input type="number" value={cfg.port} onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Usuário</Label>
            <Input value={cfg.user} onChange={(e) => setCfg({ ...cfg, user: e.target.value })} placeholder="root" />
          </div>
          <div className="space-y-1.5">
            <Label>Senha</Label>
            <Input type="password" value={cfg.password} onChange={(e) => setCfg({ ...cfg, password: e.target.value })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome do banco</Label>
            <Input value={dbName} onChange={(e) => setDbName(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())} />
            <p className="text-xs text-muted-foreground">Este banco será criado se ainda não existir.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Testar conexão
          </Button>
          {testResult && (
            <div className={`text-sm flex items-center gap-2 ${testResult.ok ? 'text-success' : 'text-destructive'}`}>
              {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {(installing || installed) && (
        <div className="rounded-xl border border-white/5 bg-card/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{installed ? 'Estrutura instalada' : 'Instalando estrutura...'}</h3>
            <span className="text-sm text-muted-foreground">{progress?.pct ?? 0}%</span>
          </div>
          <Progress value={progress?.pct ?? 0} />
          <p className="text-xs text-muted-foreground">{progress?.msg}</p>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} size="lg">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-3">
          {!installed ? (
            <Button size="lg" onClick={handleInstallSchema} disabled={installing || !testResult?.ok}>
              {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              Instalar banco
            </Button>
          ) : (
            <Button size="lg" onClick={onNext}>
              Próximo <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusRow({ variant, label, detail }: { variant: 'ok' | 'warn' | 'error'; label: string; detail?: string }) {
  const Icon = variant === 'ok' ? CheckCircle2 : AlertCircle;
  const colorClass =
    variant === 'ok' ? 'text-success' : variant === 'error' ? 'text-destructive' : 'text-warning';
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${colorClass}`} />
      <span>{label}</span>
      {detail && <span className="text-muted-foreground text-xs">— {detail}</span>}
    </div>
  );
}
