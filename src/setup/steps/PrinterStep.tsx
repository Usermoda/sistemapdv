import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, DollarSign, Loader2, Printer, RefreshCw, Scale, Usb, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api, type PrinterConfig } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ConnType = 'usb' | 'network' | 'serial';
type ScaleProto = 'toledo' | 'filizola' | 'urano' | 'generic';

export function PrinterStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [connType, setConnType] = useState<ConnType>('usb');
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [ipAddress, setIpAddress] = useState('192.168.0.100');
  const [ipPort, setIpPort] = useState(9100);
  const [width, setWidth] = useState<48 | 32>(48);
  const [drawerEnabled, setDrawerEnabled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState(false);

  const [serialPorts, setSerialPorts] = useState<Array<{ path: string; friendlyName?: string }>>([]);
  const [scaleEnabled, setScaleEnabled] = useState(false);
  const [scalePort, setScalePort] = useState('');
  const [scaleBaud, setScaleBaud] = useState(9600);
  const [scaleProtocol, setScaleProtocol] = useState<ScaleProto>('toledo');
  const [scaleTesting, setScaleTesting] = useState(false);
  const [scaleResult, setScaleResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refreshHardware();
  }, []);

  const refreshHardware = async () => {
    try {
      const [ps, sps] = await Promise.all([api.printer.list(), api.hardware.listSerialPorts()]);
      setPrinters(ps);
      setSerialPorts(sps);
      if (ps.length > 0 && !selectedPrinter) setSelectedPrinter(ps[0]);
    } catch (e) {
      console.error(e);
    }
  };

  const buildInterface = (): string => {
    if (connType === 'usb') return `printer:${selectedPrinter}`;
    if (connType === 'network') return `tcp://${ipAddress}:${ipPort}`;
    return `serial:${selectedPrinter}`;
  };

  const currentConfig = (): PrinterConfig => ({
    type: connType,
    interface: buildInterface(),
    name: selectedPrinter,
    width,
    drawerEnabled,
    drawerCode: 0,
  });

  const handleTestPrint = async () => {
    setTesting(true);
    setTestOk(false);
    const r = await api.printer.testPrint(currentConfig());
    if (r.ok) {
      toast.success('Cupom de teste enviado!');
      setTestOk(true);
    } else {
      toast.error(`Falha: ${r.error}`);
    }
    setTesting(false);
  };

  const handleTestScale = async () => {
    if (!scalePort) {
      toast.error('Selecione uma porta serial');
      return;
    }
    setScaleTesting(true);
    setScaleResult(null);
    const r = await api.hardware.testScale({
      port: scalePort,
      baudRate: scaleBaud,
      protocol: scaleProtocol,
      save: true,
    });
    if (r.ok) {
      setScaleResult({ ok: true, msg: `Peso lido: ${r.weight?.toFixed(3)} kg` });
      toast.success(`Balança OK — ${r.weight?.toFixed(3)} kg`);
    } else {
      setScaleResult({ ok: false, msg: r.error ?? 'Erro' });
    }
    setScaleTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.printer.saveConfig(currentConfig());
      toast.success('Configuração salva');
      onNext();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Impressora, Gaveta e Balança</h1>
        <p className="text-muted-foreground">Configure os equipamentos usados no PDV. Pode pular e ajustar depois.</p>
      </div>

      <div className="rounded-xl border border-white/5 bg-card/50 p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Printer className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Impressora térmica</h3>
              <p className="text-xs text-muted-foreground">ESC/POS — Epson, Bematech, Elgin, etc.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshHardware}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(['usb', 'network', 'serial'] as ConnType[]).map((t) => {
            const isActive = connType === t;
            const Icon = t === 'usb' ? Usb : t === 'network' ? Wifi : Printer;
            return (
              <button
                key={t}
                onClick={() => setConnType(t)}
                className={cn(
                  'touch-target flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all',
                  isActive ? 'border-primary bg-primary/10' : 'border-white/5 hover:border-white/20'
                )}
              >
                <Icon className={cn('w-6 h-6', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span className="text-sm font-medium capitalize">{t === 'network' ? 'Rede' : t}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {connType === 'usb' && (
            <div className="md:col-span-2 space-y-1.5">
              <Label>Impressora do Windows</Label>
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a impressora" />
                </SelectTrigger>
                <SelectContent>
                  {printers.length === 0 && <SelectItem value="__none">Nenhuma detectada</SelectItem>}
                  {printers.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Ou digite o nome exato caso não apareça na lista.</p>
              <Input value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)} placeholder="EPSON TM-T20" />
            </div>
          )}
          {connType === 'network' && (
            <>
              <div className="space-y-1.5">
                <Label>Endereço IP</Label>
                <Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="192.168.0.100" />
              </div>
              <div className="space-y-1.5">
                <Label>Porta</Label>
                <Input type="number" value={ipPort} onChange={(e) => setIpPort(Number(e.target.value))} />
              </div>
            </>
          )}
          {connType === 'serial' && (
            <div className="md:col-span-2 space-y-1.5">
              <Label>Porta serial</Label>
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a porta COM" />
                </SelectTrigger>
                <SelectContent>
                  {serialPorts.map((p) => (
                    <SelectItem key={p.path} value={p.path}>
                      {p.path} {p.friendlyName ? `— ${p.friendlyName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Largura do papel</Label>
            <Select value={String(width)} onValueChange={(v) => setWidth(Number(v) as 48 | 32)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="48">80 mm (48 colunas)</SelectItem>
                <SelectItem value="32">58 mm (32 colunas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-black/20 p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-primary" />
            <div>
              <Label className="text-foreground text-base">Gaveta de dinheiro conectada</Label>
              <p className="text-xs text-muted-foreground">Comando de abertura via impressora térmica</p>
            </div>
          </div>
          <Switch checked={drawerEnabled} onCheckedChange={setDrawerEnabled} />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleTestPrint} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Imprimir teste
          </Button>
          {testOk && (
            <div className="flex items-center gap-2 text-success text-sm">
              <CheckCircle2 className="w-4 h-4" /> Impressão realizada
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-card/50 p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Balança integrada</h3>
              <p className="text-xs text-muted-foreground">Opcional — para produtos vendidos por peso</p>
            </div>
          </div>
          <Switch checked={scaleEnabled} onCheckedChange={setScaleEnabled} />
        </div>

        {scaleEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Porta serial</Label>
              <Select value={scalePort} onValueChange={setScalePort}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a porta COM" />
                </SelectTrigger>
                <SelectContent>
                  {serialPorts.length === 0 && <SelectItem value="__none">Nenhuma detectada</SelectItem>}
                  {serialPorts.map((p) => (
                    <SelectItem key={p.path} value={p.path}>
                      {p.path} {p.friendlyName ? `— ${p.friendlyName}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Baud rate</Label>
              <Select value={String(scaleBaud)} onValueChange={(v) => setScaleBaud(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2400, 4800, 9600, 19200].map((b) => (
                    <SelectItem key={b} value={String(b)}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label>Protocolo</Label>
              <Select value={scaleProtocol} onValueChange={(v) => setScaleProtocol(v as ScaleProto)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toledo">Toledo (PRT)</SelectItem>
                  <SelectItem value="filizola">Filizola</SelectItem>
                  <SelectItem value="urano">Urano</SelectItem>
                  <SelectItem value="generic">Genérico (ASCII)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 flex gap-3 items-center">
              <Button variant="outline" onClick={handleTestScale} disabled={scaleTesting}>
                {scaleTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scale className="w-4 h-4" />}
                Testar leitura
              </Button>
              {scaleResult && (
                <span className={cn('text-sm', scaleResult.ok ? 'text-success' : 'text-destructive')}>
                  {scaleResult.msg}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} size="lg">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={onNext}>
            Pular
          </Button>
          <Button size="lg" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar e continuar <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
