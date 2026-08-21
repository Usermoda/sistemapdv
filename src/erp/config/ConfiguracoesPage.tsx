import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Printer, Scale, Wallet, FileCheck2, Users2, Plus, KeyRound, Loader2, Power, PowerOff, HardDrive, Download, Trash2, FolderOpen, RotateCcw, CreditCard, Lock, Check, X, MousePointer2, ShieldCheck, Server, Network } from 'lucide-react';
import { usePrefs } from '@/stores/prefsStore';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { api, type PrinterConfig } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { maskCep, maskCnpj, maskPhone, cn } from '@/lib/utils';
import { PERMISSION_MODULES, PROFILE_TEMPLATES, parsePermissions, serializePermissions, type PermissionKey, type PermissionMap } from '@/lib/permissions';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

type CompanyForm = {
  nome_empresa?: string;
  cpf_cpnj?: string;
  rg_ie?: string;
  im?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  email?: string;
  telefone?: string;
  simbolo_monetario?: string;
  casas_decimais?: number;
};

type SectionKey = 'empresa' | 'usuarios' | 'impressora' | 'balanca' | 'fiscal' | 'pagamentos' | 'pdv' | 'backup' | 'sistema';

export function ConfiguracoesPage() {
  const [tab, setTab] = useState<SectionKey>('empresa');

  const sections: Array<{ key: SectionKey; icon: React.ComponentType<{ className?: string }>; title: string; description: string }> = [
    {
      key: 'empresa',
      icon: Building2,
      title: 'Dados da empresa',
      description: 'Razão social, CNPJ, endereço e outras informações fiscais',
    },
    {
      key: 'usuarios',
      icon: Users2,
      title: 'Usuários e acessos',
      description: 'Cadastro de operadores, senhas e perfis',
    },
    {
      key: 'impressora',
      icon: Printer,
      title: 'Impressora e gaveta',
      description: 'Configuração da impressora térmica e da gaveta de dinheiro',
    },
    {
      key: 'balanca',
      icon: Scale,
      title: 'Balança',
      description: 'Porta serial, baud rate e protocolo da balança integrada',
    },
    {
      key: 'fiscal',
      icon: FileCheck2,
      title: 'Emissão fiscal (NFCe)',
      description: 'Provider, ambiente, série, CSC e valores padrão para tributação',
    },
    {
      key: 'pagamentos',
      icon: CreditCard,
      title: 'Formas de pagamento',
      description: 'Editar, adicionar ou remover formas de pagamento aceitas',
    },
    {
      key: 'pdv',
      icon: MousePointer2,
      title: 'Preferências do PDV',
      description: 'Modo touch, tela de confirmação de venda, tempo de auto-fechamento',
    },
    {
      key: 'backup',
      icon: HardDrive,
      title: 'Backup do banco',
      description: 'Backup automático agendado + backups manuais e restauração',
    },
    {
      key: 'sistema',
      icon: Server,
      title: 'Instalação e terminal',
      description: 'Modo (servidor/terminal), reidentificar empresa, refazer wizard',
    },
  ];

  const current = sections.find((s) => s.key === tab)!;

  return (
    <div className="h-full flex flex-col p-8 min-h-0">
      <PageHeader title="Configurações" description="Ajuste dados da empresa e dos equipamentos" />

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Vertical tab list */}
        <aside className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="rounded-xl bg-card/50 border border-white/5 p-2 space-y-0.5">
            {sections.map((s) => {
              const Icon = s.icon;
              const active = tab === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setTab(s.key)}
                  className={cn(
                    'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors touch-target',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                >
                  <Icon className={cn('w-4 h-4 flex-shrink-0', active ? 'text-primary' : '')} />
                  <span className="text-sm font-medium truncate">{s.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content panel — fixed height with scroll inside */}
        <section className="col-span-12 md:col-span-8 lg:col-span-9 min-h-0">
          <div className="rounded-xl bg-card border border-white/5 h-full flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center gap-3 p-6 border-b border-white/5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <current.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{current.title}</h2>
                <p className="text-xs text-muted-foreground">{current.description}</p>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {tab === 'empresa' && <CompanyPanel />}
              {tab === 'usuarios' && <UsersPanel />}
              {tab === 'impressora' && <PrinterPanel />}
              {tab === 'balanca' && <ScalePanel />}
              {tab === 'fiscal' && <FiscalPanel />}
              {tab === 'pagamentos' && <PaymentMethodsPanel />}
              {tab === 'pdv' && <PdvPrefsPanel />}
              {tab === 'backup' && <BackupPanel />}
              {tab === 'sistema' && <SistemaPanel onGoEmpresa={() => setTab('empresa')} />}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ============================================================
 * Panel wrappers — each opens a dialog once mounted
 * Uses key to reset internal state when tab changes
 * ============================================================ */

/**
 * Renders content either inline (inside the tab panel) or wrapped in a Dialog.
 * The title is only shown in Dialog mode since the tab panel already has a header.
 */
function InlineWrap({
  inline,
  onClose,
  title,
  maxWidth = 'max-w-2xl',
  body,
  footer,
}: {
  inline?: boolean;
  onClose?: () => void;
  title?: string;
  maxWidth?: string;
  body: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (inline) {
    return (
      <div className="space-y-4">
        {body}
        {footer && <div className="pt-4 border-t border-white/5 flex justify-end gap-2">{footer}</div>}
      </div>
    );
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className={maxWidth}>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {body}
        {footer && <DialogFooter className="gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

function UsersPanel() { return <UsersDialog inline />; }
function CompanyPanel() { return <CompanyDialog inline />; }
function PrinterPanel() { return <PrinterDialog inline />; }
function ScalePanel() { return <ScaleDialog inline />; }
function FiscalPanel() { return <FiscalDialog inline />; }
function PaymentMethodsPanel() { return <PaymentMethodsDialog inline />; }
function PdvPrefsPanel() { return <PdvPrefsDialog inline />; }
function BackupPanel() { return <BackupDialog inline />; }

function PdvPrefsDialog({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const touchMode = usePrefs((s) => s.touchMode);
  const setTouchMode = usePrefs((s) => s.setTouchMode);
  const successEnabled = usePrefs((s) => s.successEnabled);
  const setSuccessEnabled = usePrefs((s) => s.setSuccessEnabled);
  const successAutoClose = usePrefs((s) => s.successAutoClose);
  const setSuccessAutoClose = usePrefs((s) => s.setSuccessAutoClose);
  const pdvIdleTimeoutMin = usePrefs((s) => s.pdvIdleTimeoutMin);
  const setPdvIdleTimeoutMin = usePrefs((s) => s.setPdvIdleTimeoutMin);

  const body = (
    <>
      <div className="flex items-center justify-between rounded-lg bg-black/20 p-3">
        <div>
          <div className="font-medium text-sm">Modo touch</div>
          <div className="text-xs text-muted-foreground">Bloqueia digitação nos campos de valor e habilita o numpad grande</div>
        </div>
        <Switch checked={touchMode} onCheckedChange={setTouchMode} />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-black/20 p-3">
        <div>
          <div className="font-medium text-sm">Tela "Venda concluída"</div>
          <div className="text-xs text-muted-foreground">Mostra a confirmação após finalizar a venda</div>
        </div>
        <Switch checked={successEnabled} onCheckedChange={setSuccessEnabled} />
      </div>

      {successEnabled && (
        <FormField label="Auto-fechar após (segundos)" hint="0 = manual. Ex.: 3 fecha em 3 segundos automaticamente">
          <Input type="number" min={0} max={30} value={successAutoClose} onChange={(e) => setSuccessAutoClose(Number(e.target.value) || 0)} />
        </FormField>
      )}

      <FormField
        label="Logout automático por inatividade (minutos)"
        hint="Encerra a sessão do operador se não houver interação. 0 = desabilitado. Recomendado 5–15 min para operadores de caixa"
      >
        <Input type="number" min={0} max={120} value={pdvIdleTimeoutMin} onChange={(e) => setPdvIdleTimeoutMin(Number(e.target.value) || 0)} />
      </FormField>

      <div className="text-xs text-muted-foreground pt-2 border-t border-white/5">
        Atalhos na tela de confirmação: <kbd className="px-1 py-0.5 bg-secondary rounded font-mono">Enter</kbd> nova venda ·{' '}
        <kbd className="px-1 py-0.5 bg-secondary rounded font-mono">V</kbd> ver nota ·{' '}
        <kbd className="px-1 py-0.5 bg-secondary rounded font-mono">Esc</kbd> fechar
      </div>
    </>
  );

  return (
    <InlineWrap
      inline={inline}
      onClose={onClose}
      title="Preferências do PDV"
      maxWidth="max-w-lg"
      body={body}
      footer={!inline && <Button onClick={onClose}>Fechar</Button>}
    />
  );
}

type PaymentRow = { id: number; modo_lancamento: string; protegido: string | null; inativo: number };

function PaymentMethodsDialog({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows((await api.erp.paymentMethods.list()) as PaymentRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const beginEdit = (row: PaymentRow) => {
    setEditingId(row.id);
    setDraft(row.modo_lancamento);
  };

  const beginNew = () => {
    setEditingId('new');
    setDraft('');
  };

  const save = async () => {
    if (!draft.trim()) return toast.error('Informe o nome');
    setSaving(true);
    try {
      if (editingId === 'new') {
        await api.erp.paymentMethods.save({ modo_lancamento: draft.trim().toUpperCase() });
        toast.success('Forma de pagamento criada');
      } else if (typeof editingId === 'number') {
        await api.erp.paymentMethods.save({ id: editingId, modo_lancamento: draft.trim().toUpperCase() });
        toast.success('Forma de pagamento atualizada');
      }
      setEditingId(null);
      setDraft('');
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const del = async (row: PaymentRow) => {
    if (row.protegido === 'X') return toast.error('Esta forma é protegida');
    if (!confirm(`Remover "${row.modo_lancamento}"?`)) return;
    try {
      await api.erp.paymentMethods.delete(row.id);
      toast.success('Removida');
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleActive = async (row: PaymentRow) => {
    try {
      await api.erp.paymentMethods.toggleActive(row.id, !row.inativo);
      toast.success(row.inativo ? `${row.modo_lancamento} ativado` : `${row.modo_lancamento} desativado`);
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const body = (
    <>
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={beginNew} disabled={editingId !== null}>
          <Plus className="w-4 h-4" /> Nova
        </Button>
      </div>
      {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-1 max-h-[50vh] overflow-auto">
            {editingId === 'new' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
                <CreditCard className="w-4 h-4 text-primary" />
                <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ex.: PIX" className="flex-1" />
                <Button size="icon" onClick={save} disabled={saving} title="Salvar">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
              </div>
            )}
            {rows.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                  r.inativo ? 'bg-muted/30 border-white/5 opacity-60' : 'bg-card border-white/5'
                )}
              >
                <CreditCard className={cn('w-4 h-4 flex-shrink-0', r.inativo ? 'text-muted-foreground' : 'text-primary')} />
                {editingId === r.id ? (
                  <>
                    <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1" />
                    <Button size="icon" onClick={save} disabled={saving}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className={cn('font-medium text-sm', r.inativo && 'line-through')}>{r.modo_lancamento}</div>
                      <div className="text-[10px] text-muted-foreground">
                        ID {r.id}
                        {r.protegido === 'X' ? ' · não removível' : ''}
                        {r.inativo ? ' · inativo' : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(r)}
                      disabled={editingId !== null}
                      title={r.inativo ? 'Ativar' : 'Desativar'}
                    >
                      {r.inativo ? <PowerOff className="w-4 h-4 text-muted-foreground" /> : <Power className="w-4 h-4 text-success" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => beginEdit(r)} disabled={editingId !== null} title="Renomear">
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    {r.protegido === 'X' ? (
                      <div className="w-10 h-10 flex items-center justify-center" title="Forma padrão do sistema — não pode ser removida">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => del(r)} disabled={editingId !== null} title="Remover">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      <div className="text-xs text-muted-foreground pt-2">
        Todas podem ser renomeadas e ativadas/desativadas. As inativas somem do PDV e do financeiro. As com cadeado
        são referências do sistema e não podem ser removidas (só desativadas).
      </div>
    </>
  );

  return (
    <InlineWrap
      inline={inline}
      onClose={onClose}
      title="Formas de pagamento"
      maxWidth="max-w-lg"
      body={body}
      footer={!inline && <Button variant="ghost" onClick={onClose}>Fechar</Button>}
    />
  );
}

type BackupSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
  keepDays: number;
  customPath: string;
  lastRun: string | null;
};

function BackupDialog({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [files, setFiles] = useState<Array<{ name: string; path: string; size: number; created: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, f] = await Promise.all([api.backup.getSettings(), api.backup.list()]);
      setSettings(s as BackupSettings);
      setFiles(f);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const runNow = async () => {
    setRunning(true);
    const r = await api.backup.runNow();
    if (r.ok) toast.success(`Backup criado (${((r.size ?? 0) / 1024).toFixed(0)} KB)`);
    else toast.error(r.error ?? 'Falha no backup');
    await load();
    setRunning(false);
  };

  const restore = async (p: string) => {
    if (!confirm(`Restaurar este backup? Os dados atuais serão substituídos.\n\n${p}`)) return;
    const r = await api.backup.restore(p);
    if (r.ok) toast.success('Restauração concluída — considere reiniciar o app');
    else toast.error(r.error ?? 'Falha na restauração');
  };

  const del = async (name: string) => {
    if (!confirm(`Excluir "${name}"?`)) return;
    await api.backup.delete(name);
    void load();
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.backup.saveSettings(settings);
      toast.success('Configurações salvas');
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const chooseFolder = async () => {
    const p = await api.backup.chooseFolder();
    if (p && settings) setSettings({ ...settings, customPath: p });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const body = loading || !settings ? (
    <div className="py-6 text-center text-muted-foreground">Carregando...</div>
  ) : (
    <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-black/20 p-3">
              <div>
                <div className="font-medium text-sm">Backup automático diário</div>
                <div className="text-xs text-muted-foreground">Roda automaticamente no horário configurado</div>
              </div>
              <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField label="Hora">
                <Input type="number" min={0} max={23} value={settings.hour} onChange={(e) => setSettings({ ...settings, hour: Number(e.target.value) })} />
              </FormField>
              <FormField label="Minuto">
                <Input type="number" min={0} max={59} value={settings.minute} onChange={(e) => setSettings({ ...settings, minute: Number(e.target.value) })} />
              </FormField>
              <FormField label="Manter (dias)" hint="0 = infinito">
                <Input type="number" min={0} value={settings.keepDays} onChange={(e) => setSettings({ ...settings, keepDays: Number(e.target.value) })} />
              </FormField>
            </div>

            <FormField label="Pasta de destino" hint="Vazio = pasta padrão do app">
              <div className="flex gap-2">
                <Input value={settings.customPath} onChange={(e) => setSettings({ ...settings, customPath: e.target.value })} placeholder="C:\Backups\PDV" />
                <Button variant="outline" onClick={chooseFolder}>
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
            </FormField>

            {settings.lastRun && (
              <div className="text-xs text-muted-foreground">
                Último backup: {new Date(settings.lastRun).toLocaleString('pt-BR')}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={runNow} disabled={running}>
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Fazer backup agora
              </Button>
              <Button variant="outline" onClick={() => api.backup.openFolder()}>
                <FolderOpen className="w-4 h-4" /> Abrir pasta
              </Button>
              <div className="flex-1" />
              <Button onClick={saveSettings} disabled={saving}>Salvar configurações</Button>
            </div>

            <div className="pt-2 border-t border-white/5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Backups disponíveis ({files.length})</div>
              {files.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Nenhum backup ainda</div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-auto">
                  {files.map((f) => (
                    <div key={f.name} className="flex items-center gap-3 p-2 rounded-lg bg-card border border-white/5">
                      <HardDrive className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono truncate">{f.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(f.created).toLocaleString('pt-BR')} · {formatSize(f.size)}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => restore(f.path)} title="Restaurar">
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => del(f.name)} title="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
    </div>
  );

  return (
    <InlineWrap
      inline={inline}
      onClose={onClose}
      title="Backup do banco"
      maxWidth="max-w-2xl"
      body={body}
      footer={!inline && <Button variant="ghost" onClick={onClose}>Fechar</Button>}
    />
  );
}

type UserRow = { id: number; login: string; id_perfil: number; nome_perfil: string; inativo: number | null };
type ProfileRow = { id_perfil: number; nome_perfil: string; menu_options?: string; users?: number };

function UsersDialog({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null);
  const [editingProfile, setEditingProfile] = useState<ProfileRow | 'new' | null>(null);
  const [subtab, setSubtab] = useState<'users' | 'profiles'>('users');

  const load = async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([api.auth.listUsers(), api.auth.listProfiles()]);
      setUsers(u as UserRow[]);
      setProfiles(p as ProfileRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const deleteProfile = async (p: ProfileRow) => {
    if (!confirm(`Remover o perfil "${p.nome_perfil}"?`)) return;
    try {
      await api.auth.deleteProfile(p.id_perfil);
      toast.success('Perfil removido');
      void load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const body = (
    <>
        <Tabs value={subtab} onValueChange={(v) => setSubtab(v as 'users' | 'profiles')}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="users"><Users2 className="w-4 h-4 mr-1" /> Usuários</TabsTrigger>
              <TabsTrigger value="profiles"><ShieldCheck className="w-4 h-4 mr-1" /> Perfis</TabsTrigger>
            </TabsList>
            <Button size="sm" onClick={() => (subtab === 'users' ? setEditing('new') : setEditingProfile('new'))}>
              <Plus className="w-4 h-4" /> {subtab === 'users' ? 'Novo usuário' : 'Novo perfil'}
            </Button>
          </div>

          <TabsContent value="users" className="mt-4">
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-auto space-y-1">
                {users.length === 0 && <div className="text-sm text-muted-foreground p-4 text-center">Nenhum usuário</div>}
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-white/5">
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center', u.inativo ? 'bg-muted' : 'bg-primary/10')}>
                      <Users2 className={cn('w-4 h-4', u.inativo ? 'text-muted-foreground' : 'text-primary')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{u.login}</div>
                      <div className="text-xs text-muted-foreground">{u.nome_perfil}{u.inativo ? ' · inativo' : ''}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(u)} title="Editar">
                      <KeyRound className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="profiles" className="mt-4">
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-auto space-y-1">
                {profiles.map((p) => (
                  <div key={p.id_perfil} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-white/5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{p.nome_perfil}</div>
                      <div className="text-xs text-muted-foreground">
                        ID {p.id_perfil}
                        {p.id_perfil === 1 ? ' · protegido' : ''}
                        {typeof p.users === 'number' ? ` · ${p.users} usuário${p.users === 1 ? '' : 's'}` : ''}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setEditingProfile(p)} title="Editar">
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    {p.id_perfil === 1 ? (
                      <div className="w-10 h-10 flex items-center justify-center" title="Perfil protegido do sistema">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => deleteProfile(p)} title="Remover">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground pt-3 border-t border-white/5 mt-3">
              Ex: <strong>Caixa</strong> (só PDV), <strong>Gerente</strong> (relatórios + PDV), <strong>Estoquista</strong>. O perfil ADMINISTRADOR não pode ser removido.
            </div>
          </TabsContent>
        </Tabs>

        {editing && (
          <UserFormInline
            initial={editing === 'new' ? null : editing}
            profiles={profiles}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void load();
            }}
          />
        )}

        {editingProfile && (
          <ProfileFormInline
            initial={editingProfile === 'new' ? null : editingProfile}
            onClose={() => setEditingProfile(null)}
            onSaved={() => {
              setEditingProfile(null);
              void load();
            }}
          />
        )}
    </>
  );

  if (inline) return <div>{body}</div>;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Usuários e perfis</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function ProfileFormInline({
  initial,
  onClose,
  onSaved,
}: {
  initial: ProfileRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(initial?.nome_perfil ?? '');
  const [perms, setPerms] = useState<PermissionMap>(() =>
    initial?.menu_options
      ? parsePermissions(initial.menu_options)
      : (Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, false])) as PermissionMap)
  );
  const [saving, setSaving] = useState(false);

  const applyTemplate = (tplName: string) => {
    const tpl = PROFILE_TEMPLATES.find((t) => t.name === tplName);
    if (!tpl) return;
    setPerms(tpl.perms);
    if (!nome.trim()) setNome(tpl.name);
  };

  const togglePerm = (key: PermissionKey) => {
    setPerms((p) => ({ ...p, [key]: !p[key] }));
  };

  const save = async () => {
    if (!nome.trim()) return toast.error('Informe o nome do perfil');
    setSaving(true);
    try {
      await api.auth.saveProfile({
        id_perfil: initial?.id_perfil,
        nome_perfil: nome.trim().toUpperCase(),
        menu_options: serializePermissions(perms),
      });
      toast.success(initial ? 'Perfil atualizado' : 'Perfil criado');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const isAdmin = initial?.id_perfil === 1;
  const enabledCount = Object.values(perms).filter(Boolean).length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? `Editar ${initial.nome_perfil}` : 'Novo perfil'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
          <FormField label="Nome do perfil" required>
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: GERENTE" disabled={isAdmin} />
          </FormField>

          {!initial && (
            <FormField label="Começar com um modelo" hint="Aplica permissões pré-definidas — você pode ajustar depois">
              <div className="grid grid-cols-2 gap-2">
                {PROFILE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    type="button"
                    onClick={() => applyTemplate(tpl.name)}
                    className="text-left p-2 rounded-lg border border-white/5 hover:border-primary/40 transition"
                  >
                    <div className="text-sm font-semibold">{tpl.name}</div>
                    <div className="text-[10px] text-muted-foreground">{tpl.description}</div>
                  </button>
                ))}
              </div>
            </FormField>
          )}

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Permissões ({enabledCount}/{PERMISSION_MODULES.length})
            </div>
            {isAdmin ? (
              <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm">
                O perfil ADMINISTRADOR tem acesso total a todos os módulos e não pode ser restringido.
              </div>
            ) : (
              <div className="space-y-1">
                {PERMISSION_MODULES.map((mod) => (
                  <label
                    key={mod.key}
                    className={cn(
                      'flex items-center justify-between rounded-lg p-2 cursor-pointer transition-colors',
                      perms[mod.key] ? 'bg-primary/10 border border-primary/20' : 'bg-black/20 border border-transparent hover:border-white/10'
                    )}
                  >
                    <div>
                      <div className="text-sm font-medium">{mod.label}</div>
                      <div className="text-[10px] text-muted-foreground">{mod.description}</div>
                    </div>
                    <Switch checked={!!perms[mod.key]} onCheckedChange={() => togglePerm(mod.key)} />
                  </label>
                ))}
              </div>
            )}
          </div>

          {perms.pdv && !perms.dashboard && !perms.produtos && !perms.clientes && !perms.config && (
            <div className="text-xs text-primary bg-primary/10 border border-primary/30 rounded-lg p-2">
              Este perfil só tem PDV — usuários com esse perfil vão abrir diretamente na tela de vendas ao entrar.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserFormInline({
  initial,
  profiles,
  onClose,
  onSaved,
}: {
  initial: UserRow | null;
  profiles: ProfileRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [login, setLoginName] = useState(initial?.login ?? '');
  const [idPerfil, setIdPerfil] = useState(initial?.id_perfil ?? profiles[0]?.id_perfil ?? 1);
  const [senha, setSenha] = useState('');
  const [inativo, setInativo] = useState(!!initial?.inativo);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!login.trim()) return toast.error('Informe o login');
    if (!initial && !senha) return toast.error('Senha obrigatória para novo usuário');
    if (senha && senha.length < 4) return toast.error('Senha deve ter pelo menos 4 caracteres');
    setSaving(true);
    try {
      await api.auth.saveUser({
        id: initial?.id,
        login: login.trim(),
        id_perfil: Number(idPerfil),
        senha: senha || undefined,
        inativo: inativo ? 1 : 0,
      });
      toast.success(initial ? 'Usuário atualizado' : 'Usuário cadastrado');
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? `Editar ${initial.login}` : 'Novo usuário'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label="Login" required>
            <Input value={login} onChange={(e) => setLoginName(e.target.value)} disabled={!!initial} />
          </FormField>
          <FormField label="Perfil">
            <Select value={String(idPerfil)} onValueChange={(v) => setIdPerfil(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id_perfil} value={String(p.id_perfil)}>{p.nome_perfil}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={initial ? 'Nova senha (deixe em branco para manter)' : 'Senha'} required={!initial}>
            <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 4 caracteres" />
          </FormField>
          {initial && (
            <div className="flex items-center justify-between rounded-lg bg-black/20 p-3">
              <span className="text-sm">Usuário inativo</span>
              <Button variant="ghost" size="icon" onClick={() => setInativo((v) => !v)}>
                {inativo ? <PowerOff className="w-4 h-4 text-muted-foreground" /> : <Power className="w-4 h-4 text-success" />}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type FiscalSettings = {
  enabled: boolean;
  provider: 'focusnfe' | 'none';
  ambiente: 'homologacao' | 'producao';
  uf: string;
  serie: number;
  proximo_numero: number;
  regime_tributario: 1 | 2 | 3;
  cnae: string;
  ncm_padrao: string;
  cfop_padrao: string;
  cst_csosn_padrao: string;
  origem_padrao: number;
  focusnfe_token: string;
  focusnfe_csc_id: string;
  focusnfe_csc_token: string;
};

function FiscalDialog({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const [data, setData] = useState<FiscalSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.fiscal.getSettings().then((s) => setData(s as FiscalSettings));
  }, []);

  const update = <K extends keyof FiscalSettings>(k: K, v: FiscalSettings[K]) =>
    setData((d) => (d ? { ...d, [k]: v } : d));

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await api.fiscal.saveSettings(data);
      toast.success('Configuração fiscal salva');
      onClose?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const body = !data ? (
    <div className="py-6 text-center text-muted-foreground">Carregando...</div>
  ) : (
    <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-black/20 p-3">
              <div>
                <div className="font-medium text-sm">Emissão fiscal habilitada</div>
                <div className="text-xs text-muted-foreground">Cada venda gera uma NFCe automaticamente</div>
              </div>
              <Switch checked={data.enabled} onCheckedChange={(v) => update('enabled', v)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Provider">
                <Select value={data.provider} onValueChange={(v) => update('provider', v as 'focusnfe' | 'none')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="focusnfe">Focus NFe</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Ambiente">
                <Select value={data.ambiente} onValueChange={(v) => update('ambiente', v as 'homologacao' | 'producao')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="UF">
                <Select value={data.uf} onValueChange={(v) => update('uf', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Série">
                <Input type="number" value={data.serie} onChange={(e) => update('serie', Number(e.target.value))} />
              </FormField>
              <FormField label="Próximo número">
                <Input type="number" value={data.proximo_numero} onChange={(e) => update('proximo_numero', Number(e.target.value))} />
              </FormField>
              <FormField label="Regime tributário">
                <Select value={String(data.regime_tributario)} onValueChange={(v) => update('regime_tributario', Number(v) as 1 | 2 | 3)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Simples Nacional</SelectItem>
                    <SelectItem value="2">2 — Simples com sublimite</SelectItem>
                    <SelectItem value="3">3 — Regime Normal</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="pt-3 border-t border-white/5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Valores fiscais padrão para produtos</div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="NCM padrão">
                  <Input value={data.ncm_padrao} onChange={(e) => update('ncm_padrao', e.target.value)} placeholder="00000000" />
                </FormField>
                <FormField label="CFOP padrão">
                  <Input value={data.cfop_padrao} onChange={(e) => update('cfop_padrao', e.target.value)} placeholder="5102" />
                </FormField>
                <FormField label="CST/CSOSN padrão">
                  <Input value={data.cst_csosn_padrao} onChange={(e) => update('cst_csosn_padrao', e.target.value)} placeholder="102 (Simples)" />
                </FormField>
                <FormField label="Origem da mercadoria">
                  <Select value={String(data.origem_padrao)} onValueChange={(v) => update('origem_padrao', Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — Nacional</SelectItem>
                      <SelectItem value="1">1 — Importação direta</SelectItem>
                      <SelectItem value="2">2 — Importação adquirida no mercado interno</SelectItem>
                      <SelectItem value="3">3 — Nacional com importação &gt; 40%</SelectItem>
                      <SelectItem value="4">4 — Nacional prod. em conformidade</SelectItem>
                      <SelectItem value="5">5 — Nacional com importação ≤ 40%</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>

            {data.provider === 'focusnfe' && (
              <div className="pt-3 border-t border-white/5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Focus NFe — credenciais</div>
                <div className="space-y-4">
                  <FormField label="Token de acesso" hint="Encontrado no painel focusnfe.com.br">
                    <Input type="password" value={data.focusnfe_token} onChange={(e) => update('focusnfe_token', e.target.value)} placeholder="XXXXXXXX..." />
                  </FormField>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="CSC ID">
                      <Input value={data.focusnfe_csc_id} onChange={(e) => update('focusnfe_csc_id', e.target.value)} />
                    </FormField>
                    <FormField label="CSC Token">
                      <Input type="password" value={data.focusnfe_csc_token} onChange={(e) => update('focusnfe_csc_token', e.target.value)} />
                    </FormField>
                  </div>
                </div>
              </div>
            )}
    </div>
  );

  return (
    <InlineWrap
      inline={inline}
      onClose={onClose}
      title="Emissão fiscal (NFCe)"
      maxWidth="max-w-2xl"
      body={body}
      footer={
        <>
          {!inline && <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>}
          <Button onClick={handleSave} disabled={saving || !data}>Salvar</Button>
        </>
      }
    />
  );
}

function CompanyDialog({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const [data, setData] = useState<CompanyForm>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.setup
      .getCompany()
      .then((c) => setData((c as CompanyForm) ?? {}))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) => setData((d) => ({ ...d, [k]: v }));

  const handleSave = async () => {
    if (!data.nome_empresa?.trim()) return toast.error('Informe o nome da empresa');
    setSaving(true);
    try {
      await api.setup.saveCompany({ ...data, nome_empresa: data.nome_empresa.trim() });
      toast.success('Dados da empresa salvos');
      onClose?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };

  const body = loading ? (
    <div className="py-6 text-center text-muted-foreground">Carregando...</div>
  ) : (
    <div className="space-y-4">
            <FormField label="Razão social" required>
              <Input value={data.nome_empresa ?? ''} onChange={(e) => update('nome_empresa', e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="CNPJ">
                <Input value={data.cpf_cpnj ?? ''} onChange={(e) => update('cpf_cpnj', maskCnpj(e.target.value))} />
              </FormField>
              <FormField label="IE">
                <Input value={data.rg_ie ?? ''} onChange={(e) => update('rg_ie', e.target.value)} />
              </FormField>
              <FormField label="IM">
                <Input value={data.im ?? ''} onChange={(e) => update('im', e.target.value)} />
              </FormField>
              <FormField label="Telefone">
                <Input value={data.telefone ?? ''} onChange={(e) => update('telefone', maskPhone(e.target.value))} />
              </FormField>
              <FormField label="E-mail" className="col-span-2">
                <Input value={data.email ?? ''} onChange={(e) => update('email', e.target.value)} type="email" />
              </FormField>
              <FormField label="CEP">
                <Input value={data.cep ?? ''} onChange={(e) => update('cep', maskCep(e.target.value))} />
              </FormField>
              <FormField label="UF">
                <Select value={data.uf ?? 'SP'} onValueChange={(v) => update('uf', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Endereço" className="col-span-2">
                <Input value={data.endereco ?? ''} onChange={(e) => update('endereco', e.target.value)} />
              </FormField>
              <FormField label="Bairro">
                <Input value={data.bairro ?? ''} onChange={(e) => update('bairro', e.target.value)} />
              </FormField>
              <FormField label="Cidade">
                <Input value={data.cidade ?? ''} onChange={(e) => update('cidade', e.target.value)} />
              </FormField>
            </div>
    </div>
  );

  return (
    <InlineWrap
      inline={inline}
      onClose={onClose}
      title="Dados da empresa"
      maxWidth="max-w-2xl"
      body={body}
      footer={
        <>
          {!inline && <Button variant="ghost" onClick={onClose}>Cancelar</Button>}
          <Button onClick={handleSave} disabled={saving || loading}>Salvar</Button>
        </>
      }
    />
  );
}

// Module-level cache — keeps the printer list between panel opens within the same session
let printersCache: string[] = [];

function PrinterDialog({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const [cfg, setCfg] = useState<PrinterConfig>({ type: 'usb', interface: '', autoPreview: 'when-no-printer' });
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState<string[]>(printersCache);
  const [printersLoading, setPrintersLoading] = useState(printersCache.length === 0);
  const [testing, setTesting] = useState(false);

  // Config is fast (local JSON) — load first so the form renders immediately
  useEffect(() => {
    api.printer
      .getConfig()
      .then((c) => {
        setCfg({
          type: c.type ?? 'usb',
          interface: c.interface ?? '',
          name: c.name,
          width: c.width ?? 48,
          drawerEnabled: c.drawerEnabled,
          autoPreview: c.autoPreview ?? 'when-no-printer',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  // Printers list is slow (spawns PowerShell) — load in background, use cache when available
  const loadPrinters = () => {
    setPrintersLoading(true);
    api.printer
      .list()
      .then((p) => {
        setPrinters(p);
        printersCache = p;
      })
      .finally(() => setPrintersLoading(false));
  };

  useEffect(() => {
    if (printersCache.length === 0) loadPrinters();
  }, []);

  const handleSave = async () => {
    try {
      await api.printer.saveConfig(cfg);
      toast.success('Impressora configurada');
      onClose?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const r = await api.printer.testPrint(cfg);
    if (r.ok) toast.success('Teste impresso');
    else toast.error(r.error ?? 'Falha na impressão');
    setTesting(false);
  };

  const body = loading ? (
    <div className="py-6 text-center text-muted-foreground">Carregando...</div>
  ) : (
    <div className="space-y-4">
            <FormField label="Conexão">
              <Select value={cfg.type} onValueChange={(v) => setCfg({ ...cfg, type: v as 'usb' | 'network' | 'serial' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usb">USB</SelectItem>
                  <SelectItem value="network">Rede</SelectItem>
                  <SelectItem value="serial">Serial</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {cfg.type === 'usb' && (
              <>
                <FormField
                  label="Impressora"
                  hint={printersLoading ? 'Buscando impressoras do sistema...' : undefined}
                >
                  <div className="flex gap-2">
                    <Select
                      value={cfg.name ?? ''}
                      onValueChange={(v) => setCfg({ ...cfg, name: v, interface: `printer:${v}` })}
                      disabled={printersLoading && printers.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={printersLoading && printers.length === 0 ? 'Carregando...' : 'Selecione...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {printers.length === 0 && !printersLoading && (
                          <SelectItem value="__none" disabled>Nenhuma impressora detectada</SelectItem>
                        )}
                        {printers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={loadPrinters} disabled={printersLoading} title="Recarregar lista">
                      {printersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    </Button>
                  </div>
                </FormField>
                <FormField label="Ou nome exato" hint="Se sua impressora não aparecer na lista, digite o nome exato do Windows">
                  <Input value={cfg.name ?? ''} onChange={(e) => setCfg({ ...cfg, name: e.target.value, interface: `printer:${e.target.value}` })} />
                </FormField>
              </>
            )}

            {cfg.type === 'network' && (
              <FormField label="Endereço TCP (host:porta)">
                <Input value={cfg.interface.replace(/^tcp:\/\//, '')} onChange={(e) => setCfg({ ...cfg, interface: `tcp://${e.target.value}` })} placeholder="192.168.0.100:9100" />
              </FormField>
            )}

            {cfg.type === 'serial' && (
              <FormField label="Porta COM">
                <Input value={cfg.interface.replace(/^serial:/, '')} onChange={(e) => setCfg({ ...cfg, interface: `serial:${e.target.value}` })} placeholder="COM1" />
              </FormField>
            )}

            <FormField label="Largura do papel">
              <Select value={String(cfg.width ?? 48)} onValueChange={(v) => setCfg({ ...cfg, width: Number(v) as 48 | 32 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="48">80 mm (48 col)</SelectItem>
                  <SelectItem value="32">58 mm (32 col)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <div className="flex items-center justify-between rounded-lg bg-black/20 p-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Gaveta conectada</span>
              </div>
              <Switch checked={!!cfg.drawerEnabled} onCheckedChange={(v) => setCfg({ ...cfg, drawerEnabled: v })} />
            </div>

            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Preview da nota após venda</div>
              <FormField label="Quando abrir o preview visual" hint="Útil quando não tem impressora térmica conectada">
                <Select value={cfg.autoPreview ?? 'when-no-printer'} onValueChange={(v) => setCfg({ ...cfg, autoPreview: v as 'always' | 'when-no-printer' | 'never' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Sempre — abre o preview em toda venda</SelectItem>
                    <SelectItem value="when-no-printer">Só quando não há impressora térmica</SelectItem>
                    <SelectItem value="never">Nunca — só via botão "Ver nota"</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
    </div>
  );

  return (
    <InlineWrap
      inline={inline}
      onClose={onClose}
      title="Impressora e gaveta"
      maxWidth="max-w-lg"
      body={body}
      footer={
        <>
          <Button variant="outline" onClick={handleTest} disabled={testing || loading}>
            <Printer className="w-4 h-4" /> Testar
          </Button>
          {!inline && <Button variant="ghost" onClick={onClose}>Cancelar</Button>}
          <Button onClick={handleSave} disabled={loading}>Salvar</Button>
        </>
      }
    />
  );
}

function ScaleDialog({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const [ports, setPorts] = useState<Array<{ path: string; friendlyName?: string }>>([]);
  const [selPort, setSelPort] = useState('');
  const [baud, setBaud] = useState(9600);
  const [proto, setProto] = useState<'toledo' | 'filizola' | 'urano' | 'generic'>('toledo');
  const [enabled, setEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.hardware
      .listSerialPorts()
      .then(setPorts)
      .finally(() => setLoading(false));
  }, []);

  const handleTest = async () => {
    if (!selPort) return toast.error('Selecione uma porta');
    setTesting(true);
    setResult(null);
    const r = await api.hardware.testScale({ port: selPort, baudRate: baud, protocol: proto, save: true });
    if (r.ok) {
      setEnabled(true);
      setResult(`Peso lido: ${r.weight?.toFixed(3)} kg`);
      toast.success('Balança configurada e ativa');
    } else {
      setResult(r.error ?? 'Falha na leitura');
    }
    setTesting(false);
  };

  const body = loading ? (
    <div className="py-6 text-center text-muted-foreground">Carregando...</div>
  ) : (
    <div className="space-y-4">
            <FormField label="Porta serial">
              <Select value={selPort} onValueChange={setSelPort}>
                <SelectTrigger><SelectValue placeholder="Selecione a porta COM" /></SelectTrigger>
                <SelectContent>
                  {ports.length === 0 && <SelectItem value="__none">Nenhuma detectada</SelectItem>}
                  {ports.map((p) => (
                    <SelectItem key={p.path} value={p.path}>
                      {p.path} {p.friendlyName ? `— ${p.friendlyName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Baud rate">
                <Select value={String(baud)} onValueChange={(v) => setBaud(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2400, 4800, 9600, 19200].map((b) => <SelectItem key={b} value={String(b)}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Protocolo">
                <Select value={proto} onValueChange={(v) => setProto(v as typeof proto)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toledo">Toledo</SelectItem>
                    <SelectItem value="filizola">Filizola</SelectItem>
                    <SelectItem value="urano">Urano</SelectItem>
                    <SelectItem value="generic">Genérico</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            {result && <div className="text-sm text-muted-foreground rounded-lg bg-black/20 p-3">{result}</div>}
            {enabled && <div className="text-xs text-success">Balança ativa — o botão de leitura no PDV está funcionando</div>}
    </div>
  );

  return (
    <InlineWrap
      inline={inline}
      onClose={onClose}
      title="Balança"
      maxWidth="max-w-lg"
      body={body}
      footer={
        <>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            <Scale className="w-4 h-4" /> Testar leitura
          </Button>
          {!inline && <Button variant="ghost" onClick={onClose}>Fechar</Button>}
        </>
      }
    />
  );
}

/* ============================================================
 * SistemaPanel — Instalação, modo (servidor/terminal), reconfigurar
 * ============================================================ */

function SistemaPanel({ onGoEmpresa }: { onGoEmpresa: () => void }) {
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<{ nome_empresa?: string; cpf_cpnj?: string } | null>(null);
  const [status, setStatus] = useState<{ mode: 'server' | 'terminal'; dbHost?: string; dbPort?: number } | null>(null);
  const [lanInfo, setLanInfo] = useState<{ shareOnLan: boolean; lanIps: string[]; port: number; bundled: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const s = await api.getSetupStatus();
        const e = await api.setup.getCompany();
        const lan = await api.db.getLanInfo();
        setStatus({ mode: s.mode });
        setEmpresa(e ?? null);
        setLanInfo(lan);
      } catch (err) {
        toast.error((err as Error).message);
      }
    })();
  }, []);

  const restartWizard = () => {
    // A rota /setup/* não passa pelo SetupGuard — abre o wizard direto.
    // Nada é apagado: os dados persistem e o wizard funciona como "editor".
    navigate('/setup/welcome');
  };

  const toggleLan = async (enabled: boolean) => {
    setBusy(true);
    try {
      const r = await api.db.setLanSharing(enabled);
      if (!r.ok) throw new Error(r.error ?? 'Falha');
      setLanInfo((prev) => (prev ? { ...prev, shareOnLan: !!r.enabled, lanIps: r.lanIps ?? prev.lanIps, port: r.port ?? prev.port } : prev));
      toast.success(enabled ? 'Compartilhamento LAN ativado' : 'Compartilhamento LAN desativado');
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      {/* Identificação */}
      <div className="rounded-xl border border-white/5 bg-card/50 p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Identificação</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow icon={<Building2 className="w-4 h-4" />} label="Empresa" value={empresa?.nome_empresa ?? '—'} sub={empresa?.cpf_cpnj ?? undefined} />
          <InfoRow
            icon={<Server className="w-4 h-4" />}
            label="Modo desta instalação"
            value={status?.mode === 'terminal' ? 'Terminal adicional' : 'Servidor principal'}
            sub={status?.mode === 'terminal' ? 'Conectado a um servidor remoto' : 'Hospeda o banco de dados'}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onGoEmpresa}>
            <Building2 className="w-4 h-4" /> Editar dados da empresa
          </Button>
          <Button variant="ghost" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="w-4 h-4" /> Refazer wizard
          </Button>
        </div>
      </div>

      {/* Rede local (só faz sentido no modo servidor com MariaDB portable) */}
      {status?.mode === 'server' && lanInfo?.bundled && (
        <div className="rounded-xl border border-white/5 bg-card/50 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Rede local</div>
              <div className="mt-1 font-semibold flex items-center gap-2">
                <Network className="w-4 h-4 text-primary" />
                Compartilhar com outros terminais
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Libera o MariaDB portable para receber conexões de outros PCs na mesma rede.
              </div>
            </div>
            <Switch checked={lanInfo.shareOnLan} onCheckedChange={toggleLan} disabled={busy} />
          </div>
          {lanInfo.shareOnLan && lanInfo.lanIps.length > 0 && (
            <div className="mt-4 rounded-lg bg-black/20 p-3 space-y-2 text-xs">
              <div className="text-muted-foreground">Endereços para configurar nos terminais:</div>
              <div className="space-y-1 font-mono">
                {lanInfo.lanIps.map((ip) => (
                  <div key={ip} className="text-primary">{ip}:{lanInfo.port}</div>
                ))}
              </div>
              <div className="text-[11px] text-warning pt-1 border-t border-white/5 mt-2">
                ⚠ Confirme que a porta {lanInfo.port} está aberta no Firewall do Windows.
                Veja <code className="text-foreground">docs/multi-terminal.md</code>.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog de confirmação — refazer wizard */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-warning" />
              Refazer configuração inicial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              O wizard vai reabrir do início. <strong>Nenhum dado é apagado</strong> — sua empresa,
              usuários, produtos e vendas permanecem. Você pode ajustar qualquer etapa que
              precise (mudar servidor, trocar impressora, etc.).
            </p>
            <p className="text-muted-foreground text-xs">
              Se você quiser <strong>trocar de modo</strong> (servidor ↔ terminal), essa é a via.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                setConfirmReset(false);
                void restartWizard();
              }}
              disabled={busy}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              Abrir wizard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-black/20 p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}
