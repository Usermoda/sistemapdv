import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  Info,
  Laptop,
  Loader2,
  Network,
  Plug,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
  const [mode, setMode] = useState<'server' | 'terminal'>('server');
  const [detection, setDetection] = useState<Detection | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [cfg, setCfg] = useState<ConnectionConfig>({ host: '127.0.0.1', port: 5432, user: 'postgres', password: '' });
  const [dbName, setDbName] = useState('sistema_pdv');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<{ msg: string; pct: number } | null>(null);
  const [installed, setInstalled] = useState(false);
  const [shareOnLan, setShareOnLan] = useState(false);
  const [lanInfo, setLanInfo] = useState<{ lanIps: string[]; port: number } | null>(null);
  const [togglingShare, setTogglingShare] = useState(false);
  const [addingFwRule, setAddingFwRule] = useState(false);

  const [autoInstalling, setAutoInstalling] = useState(false);
  const [autoProgress, setAutoProgress] = useState<BundledProgress>(null);

  useEffect(() => {
    void runDetection();
    const offSchema = api.db.onInstallProgress((p) => setProgress(p));
    const offBundled = api.db.onInstallBundledProgress((u) => setAutoProgress(u));
    void api.db.getLanInfo().then((r) => {
      setShareOnLan(r.shareOnLan);
      setLanInfo({ lanIps: r.lanIps, port: r.port });
    });
    return () => {
      offSchema();
      offBundled();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-detecta quando o usuário troca a porta (com debounce pra não bater
  // no IPC a cada tecla). Pula o primeiro render — a detecção inicial já
  // foi feita no useEffect de mount acima.
  const skipFirstPortDetect = useRef(true);
  useEffect(() => {
    if (skipFirstPortDetect.current) {
      skipFirstPortDetect.current = false;
      return;
    }
    if (mode !== 'server') return;
    const t = setTimeout(() => {
      void runDetection();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.port, mode]);

  const applyMode = async (m: 'server' | 'terminal') => {
    setMode(m);
    await api.setSetupMode(m);
    // Se muda para terminal, reseta config para host vazio para o usuário preencher o IP do servidor.
    if (m === 'terminal') {
      setCfg({ host: '', port: 5432, user: 'postgres', password: '' });
      setTestResult(null);
      setInstalled(false);
    }
  };

  const handleConnectOnly = async () => {
    setInstalling(true);
    try {
      const test = await api.db.test(cfg);
      if (!test.ok) throw new Error(test.error ?? 'Falha ao conectar');
      await api.db.saveConfig({ ...cfg, database: dbName });
      setInstalled(true);
      toast.success('Terminal conectado ao servidor!');
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    setInstalling(false);
  };

  const handleToggleShare = async (enabled: boolean) => {
    setTogglingShare(true);
    try {
      const r = await api.db.setLanSharing(enabled);
      if (!r.ok) throw new Error(r.error ?? 'Falha');
      setShareOnLan(!!r.enabled);
      if (r.lanIps) setLanInfo({ lanIps: r.lanIps, port: r.port ?? 5432 });
      toast.success(enabled ? 'Servidor liberado na rede local' : 'Compartilhamento LAN desativado');
    } catch (e) {
      toast.error((e as Error).message);
    }
    setTogglingShare(false);
  };

  const openFirewallPort = async () => {
    if (!lanInfo) return;
    setAddingFwRule(true);
    try {
      const r = await api.addFirewallRule(lanInfo.port, 'Bipa PostgreSQL');
      if (!r.ok) throw new Error(r.error ?? 'Falha');
      toast.success(`Porta ${lanInfo.port} liberada no Firewall`);
    } catch (e) {
      toast.error(`Firewall: ${(e as Error).message}`);
    }
    setAddingFwRule(false);
  };

  const runDetection = async () => {
    setDetecting(true);
    try {
      const d = await api.db.detect(cfg.port);
      setDetection(d);
    } catch (e) {
      toast.error(`Falha ao detectar PostgreSQL: ${(e as Error).message}`);
    }
    setDetecting(false);
  };

  const handleAutoInstall = async () => {
    setAutoInstalling(true);
    setAutoProgress({ phase: 'download', msg: 'Iniciando...', pct: 0 });
    try {
      const r = await api.db.installBundled();
      if (r.ok) {
        const chosenPort = r.port ?? 5432;
        toast.success(`PostgreSQL instalado na porta ${chosenPort}`);
        const nextCfg = { host: '127.0.0.1', port: chosenPort, user: 'postgres', password: '' };
        setCfg(nextCfg);
        await runDetection();
        const test = await api.db.test(nextCfg);
        setTestResult({
          ok: test.ok,
          message: test.ok ? `Conectado — ${test.version ?? 'PostgreSQL'}` : test.error ?? 'Erro',
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
    setTestResult({
      ok: r.ok,
      message: r.ok ? `Conectado — ${r.version ?? 'PostgreSQL'}` : r.error ?? 'Erro ao conectar',
    });
    setTesting(false);
    // Se conectou, refresca o card de status pra refletir o servidor real
    // (evita o usuário ter que clicar "Detectar novamente" manualmente).
    if (r.ok) void runDetection();
  };

  const handleInstallSchema = async () => {
    setInstalling(true);
    setProgress({ msg: 'Verificando servidor...', pct: 0 });
    try {
      const effectiveCfg = cfg;

      // Testa conexão
      const test = await api.db.test(cfg);
      if (!test.ok) throw new Error(test.error ?? 'Falha ao conectar no servidor informado');

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
        <h1 className="text-3xl font-bold tracking-tight mb-2">Banco de Dados</h1>
        <p className="text-muted-foreground">
          {mode === 'server'
            ? 'Vamos detectar o PostgreSQL, criar o banco e instalar toda a estrutura.'
            : 'Informe o endereço do servidor Bipa principal na sua rede.'}
        </p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => applyMode('server')}
          className={`p-5 rounded-xl border-2 transition text-left ${
            mode === 'server' ? 'border-primary bg-primary/10' : 'border-white/5 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <Server className={`w-5 h-5 ${mode === 'server' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="text-sm font-semibold">Servidor principal</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Primeira instalação. Cria o banco local e (opcional) libera para outros terminais.
          </div>
        </button>
        <button
          type="button"
          onClick={() => applyMode('terminal')}
          className={`p-5 rounded-xl border-2 transition text-left ${
            mode === 'terminal' ? 'border-primary bg-primary/10' : 'border-white/5 hover:border-white/20'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <Laptop className={`w-5 h-5 ${mode === 'terminal' ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="text-sm font-semibold">Terminal adicional</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Conectar a um servidor Bipa que já está rodando em outra máquina na rede.
          </div>
        </button>
      </div>

      {mode === 'server' && <motion.div
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
              <h3 className="font-semibold">Status do PostgreSQL</h3>
              <p className="text-xs text-muted-foreground">Detecção do PostgreSQL local ou portátil</p>
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
                  label={detection?.bundled ? 'PostgreSQL portable instalado' : 'PostgreSQL instalado'}
                  detail={detection?.version}
                />
                <StatusRow variant="ok" label={`Serviço rodando na porta ${detection?.port}`} />
              </>
            )}
            {status === 'installed-stopped' && (
              <>
                <StatusRow
                  variant="ok"
                  label={detection?.bundled ? 'PostgreSQL portable instalado' : 'PostgreSQL instalado'}
                  detail={detection?.version}
                />
                <StatusRow variant="warn" label="Serviço não está rodando" />
              </>
            )}
            {status === 'not-installed' && (
              <>
                <StatusRow variant="warn" label="Nenhum PostgreSQL detectado" />
                <StatusRow variant="warn" label={`Porta ${detection?.port} livre`} detail="pronto para instalar" />
              </>
            )}
            {status === 'port-conflict' && (
              <>
                <StatusRow variant="warn" label="Nenhum PostgreSQL instalado" />
                <StatusRow
                  variant="error"
                  label={`Porta ${detection?.port} está em uso por outro processo`}
                  detail="conflito"
                />
                <div className="mt-3 flex gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-destructive" />
                  <div className="text-xs">
                    <p className="text-foreground/90">
                      Algo está usando a porta {detection?.port} mas não conseguimos identificar como PostgreSQL.
                      Feche o processo conflitante ou escolha outra porta para instalar.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>}

      {mode === 'server' && showAutoInstall && (
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
                Podemos baixar e configurar o PostgreSQL automaticamente (~40 MB). Portable, não requer permissões de administrador, roda apenas para este sistema.
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
              <h3 className="font-semibold">Instalando PostgreSQL...</h3>
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
            {mode === 'terminal' ? <Plug className="w-5 h-5 text-primary" /> : <Database className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <h3 className="font-semibold">{mode === 'terminal' ? 'Conectar ao servidor' : 'Conexão'}</h3>
            <p className="text-xs text-muted-foreground">
              {mode === 'terminal' ? 'IP ou nome da máquina onde o Bipa está instalado' : 'Credenciais do servidor PostgreSQL'}
            </p>
          </div>
        </div>

        {mode === 'terminal' && (
          <div className="flex gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
            <div className="text-muted-foreground">
              Antes de continuar, verifique se na máquina servidor você <strong>ativou o compartilhamento LAN</strong>
              (aba deste passo no servidor) e liberou a porta <strong>5432</strong> no Firewall do Windows.
              Veja o guia <code className="text-foreground">docs/multi-terminal.md</code>.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Host {mode === 'terminal' && '(IP do servidor)'}</Label>
            <Input value={cfg.host} onChange={(e) => setCfg({ ...cfg, host: e.target.value })} placeholder={mode === 'terminal' ? '192.168.0.10' : '127.0.0.1'} />
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

      {mode === 'server' && (installing || installed) && (
        <div className="rounded-xl border border-white/5 bg-card/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{installed ? 'Estrutura instalada' : 'Instalando estrutura...'}</h3>
            <span className="text-sm text-muted-foreground">{progress?.pct ?? 0}%</span>
          </div>
          <Progress value={progress?.pct ?? 0} />
          <p className="text-xs text-muted-foreground">{progress?.msg}</p>
        </div>
      )}

      {/* LAN sharing — visível quando servidor com banco já instalado */}
      {mode === 'server' && installed && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Network className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Compartilhar com outros terminais</h3>
                <p className="text-xs text-muted-foreground">
                  Libera o PostgreSQL para receber conexões de outros PCs na mesma rede.
                </p>
              </div>
            </div>
            <Switch checked={shareOnLan} onCheckedChange={handleToggleShare} disabled={togglingShare} />
          </div>

          {shareOnLan && lanInfo && lanInfo.lanIps.length > 0 && (
            <div className="rounded-lg bg-black/20 p-3 space-y-3 text-xs">
              <div>
                <div className="text-muted-foreground mb-1">Use um destes endereços nos terminais adicionais:</div>
                <div className="space-y-1 font-mono">
                  {lanInfo.lanIps.map((ip) => (
                    <div key={ip} className="flex items-center gap-2">
                      <span className="text-primary">{ip}</span>
                      <span className="text-muted-foreground">:</span>
                      <span className="text-primary">{lanInfo.port}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={openFirewallPort} disabled={addingFwRule}>
                  {addingFwRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  Liberar porta {lanInfo.port} no Firewall
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Vai pedir permissão de administrador (UAC).
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} size="lg">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-3">
          {!installed ? (
            mode === 'terminal' ? (
              <Button size="lg" onClick={handleConnectOnly} disabled={installing || !testResult?.ok}>
                {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                Conectar
              </Button>
            ) : (
              <Button size="lg" onClick={handleInstallSchema} disabled={installing || !testResult?.ok}>
                {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Instalar banco
              </Button>
            )
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
