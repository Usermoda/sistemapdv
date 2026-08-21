import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Package, Plus, Printer, Search, Tag, Trash2, X } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormField } from '@/components/FormField';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

type ProductRow = {
  id: number;
  nome_produto: string;
  cod_barra: string | null;
  vr_venda: number | null;
  unidade: string | null;
  inf_adicional?: string | null;
};

type Selected = ProductRow & { qtd: number };

type PromoTier = { id_produto: number; quantidade_minima: number; vr_promocao: number };

type LabelSize = { key: string; label: string; widthMm: number; heightMm: number; cols: number };
type PrintMode = 'a4' | 'bobina80' | 'bobina90';

const SIZES: LabelSize[] = [
  { key: '50x30-3', label: '50×30 mm (3 colunas)', widthMm: 50, heightMm: 30, cols: 3 },
  { key: '40x25-4', label: '40×25 mm (4 colunas)', widthMm: 40, heightMm: 25, cols: 4 },
  { key: '60x40-3', label: '60×40 mm (3 colunas)', widthMm: 60, heightMm: 40, cols: 3 },
  { key: '100x50-2', label: '100×50 mm (2 colunas)', widthMm: 100, heightMm: 50, cols: 2 },
  { key: '80x40-1', label: '80×40 mm (bobina)', widthMm: 80, heightMm: 40, cols: 1 },
  { key: '80x30-1', label: '80×30 mm (bobina)', widthMm: 80, heightMm: 30, cols: 1 },
  { key: '90x40-1', label: '90×40 mm (bobina)', widthMm: 90, heightMm: 40, cols: 1 },
];

export function EtiquetasPage() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [sizeKey, setSizeKey] = useState<string>(SIZES[0].key);
  const [printMode, setPrintMode] = useState<PrintMode>('a4');
  const [showName, setShowName] = useState(true);
  const [showBarcode, setShowBarcode] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCode, setShowCode] = useState(true);
  const [showPackaging, setShowPackaging] = useState(true);
  const [showUnitPrice, setShowUnitPrice] = useState(true);
  const [showPromo, setShowPromo] = useState(true);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [promoTiers, setPromoTiers] = useState<PromoTier[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api.erp.products.list({ search, limit: 40 });
      setResults(r.rows as unknown as ProductRow[]);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void api.pdv.listActivePromoTiers().then((t) => setPromoTiers(t as unknown as PromoTier[]));
  }, []);

  // Best promo for a product = lowest vr_promocao among active tiers
  const promoFor = useMemo(() => {
    const map = new Map<number, PromoTier>();
    for (const t of promoTiers) {
      const cur = map.get(t.id_produto);
      if (!cur || t.vr_promocao < cur.vr_promocao) map.set(t.id_produto, t);
    }
    return (id: number) => map.get(id);
  }, [promoTiers]);

  const size = SIZES.find((s) => s.key === sizeKey)!;

  const add = (p: ProductRow) => {
    setSelected((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qtd: next[idx].qtd + 1 };
        return next;
      }
      return [...prev, { ...p, qtd: 1 }];
    });
  };

  const setQtd = (id: number, qtd: number) =>
    setSelected((prev) => prev.map((p) => (p.id === id ? { ...p, qtd: Math.max(1, qtd) } : p)));

  const remove = (id: number) => setSelected((prev) => prev.filter((p) => p.id !== id));

  const clear = () => setSelected([]);

  const totalLabels = selected.reduce((s, p) => s + p.qtd, 0);

  const addAllVisible = () => {
    if (results.length === 0) return;
    setSelected((prev) => {
      const next = [...prev];
      for (const p of results) {
        const idx = next.findIndex((x) => x.id === p.id);
        if (idx >= 0) next[idx] = { ...next[idx], qtd: next[idx].qtd + 1 };
        else next.push({ ...p, qtd: 1 });
      }
      return next;
    });
    toast.success(`+${results.length} produtos adicionados`);
  };

  const generateSvgBarcode = (code: string): string => {
    if (!code) return '';
    try {
      const svg = document.createElement('svg') as unknown as SVGSVGElement;
      JsBarcode(svg, code, {
        format: code.length === 13 ? 'EAN13' : code.length === 8 ? 'EAN8' : 'CODE128',
        width: 1.6,
        height: 30,
        displayValue: false,
        margin: 0,
      });
      return svg.outerHTML;
    } catch {
      return '';
    }
  };

  const buildHtml = (): string => {
    const labels: string[] = [];
    const unitPriceText = (p: Selected): string => {
      if (!showUnitPrice) return '';
      const u = (p.unidade ?? '').toUpperCase();
      if (u === 'KG' || u === 'L' || u === 'G' || u === 'ML') {
        const base = Number(p.vr_venda ?? 0);
        const promo = showPromo ? promoFor(p.id) : undefined;
        const price = promo && promo.vr_promocao > 0 && promo.vr_promocao < base ? promo.vr_promocao : base;
        return `Preço de 1 ${u.toLowerCase()} = ${formatCurrency(price)}`;
      }
      return '';
    };
    const packagingText = (p: Selected): string => {
      if (!showPackaging) return '';
      const parts: string[] = [];
      if (p.inf_adicional) parts.push(p.inf_adicional);
      if (p.unidade) parts.push(p.unidade);
      return parts.join(' · ');
    };
    const fmtBr = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    for (const p of selected) {
      const base = Number(p.vr_venda ?? 0);
      const promo = showPromo ? promoFor(p.id) : undefined;
      const hasPromo = !!promo && promo.vr_promocao > 0 && promo.vr_promocao < base;
      const displayPrice = hasPromo ? promo!.vr_promocao : base;
      const tierHint = hasPromo && promo!.quantidade_minima > 1 ? `A partir de ${promo!.quantidade_minima} un` : '';
      for (let i = 0; i < p.qtd; i++) {
        const barcode = showBarcode && p.cod_barra ? generateSvgBarcode(p.cod_barra) : '';
        labels.push(`
          <div class="label label-gondola">
            ${hasPromo ? `<div class="g-promo-ribbon">PROMOÇÃO${tierHint ? ` · ${escapeHtml(tierHint)}` : ''}</div>` : ''}
            <div class="g-body">
              <div class="g-left">
                ${showName ? `<div class="g-name">${escapeHtml(p.nome_produto)}</div>` : ''}
                ${packagingText(p) ? `<div class="g-pkg">${escapeHtml(packagingText(p))}</div>` : ''}
                ${barcode ? `<div class="g-barcode">${barcode}</div>` : ''}
                ${showCode && p.cod_barra ? `<div class="g-code">${escapeHtml(p.cod_barra)}</div>` : ''}
              </div>
              <div class="g-right">
                ${showPrice ? `
                  ${hasPromo ? `<div class="g-old">de R$ ${fmtBr(base)}</div>` : ''}
                  <div class="g-rs">R$</div>
                  <div class="g-price ${hasPromo ? 'g-price-promo' : ''}">${fmtBr(displayPrice)}</div>
                ` : ''}
              </div>
            </div>
            ${unitPriceText(p) ? `<div class="g-footer">${escapeHtml(unitPriceText(p))}</div>` : ''}
          </div>
        `);
      }
    }
    const isRoll = printMode !== 'a4';
    const rollWidthMm = printMode === 'bobina80' ? 80 : 90;
    const pageCss = isRoll
      ? `@page { size: ${rollWidthMm}mm ${size.heightMm}mm; margin: 0; }`
      : `@page { size: A4; margin: 6mm; }`;
    const sheetCss = isRoll
      ? `.sheet { display: flex; flex-direction: column; }
         .label { page-break-after: always; break-after: page; margin: 0 auto; }
         .label:last-child { page-break-after: auto; }`
      : `.sheet { display: grid; grid-template-columns: repeat(${size.cols}, 1fr); gap: 2mm; padding: 4mm; }`;

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Etiquetas</title>
<style>
  ${pageCss}
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
  ${sheetCss}
  .label {
    width: ${size.widthMm}mm;
    height: ${size.heightMm}mm;
    ${isRoll ? '' : 'border: 1px dashed #ddd;'}
    padding: 1.5mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .name { font-size: ${size.heightMm < 30 ? 8 : 9}pt; font-weight: bold; line-height: 1.05; max-height: 3em; overflow: hidden; }
  .barcode svg { width: 100% !important; max-width: ${size.widthMm - 4}mm; height: auto; max-height: ${Math.min(size.heightMm * 0.4, 12)}mm; }
  .code { font-family: 'Courier New', monospace; font-size: 6.5pt; }
  .price { font-size: ${size.heightMm < 30 ? 10 : 12}pt; font-weight: 800; }

  /* Gôndola style — clean supermarket tag (white bg) */
  .label-gondola {
    padding: 0;
    background: #fff;
    color: #000;
    display: flex;
    flex-direction: column;
    justify-content: stretch;
  }
  .label-gondola .g-pkg {
    font-size: ${Math.max(5, size.heightMm < 30 ? 5 : 5.5)}pt;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 0.2mm;
  }
  .label-gondola .g-body {
    flex: 1;
    display: flex;
    align-items: stretch;
    min-height: 0;
    padding: 1.2mm 1.5mm 0 1.5mm;
  }
  .label-gondola .g-left {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
    padding-right: 1mm;
  }
  .label-gondola .g-name {
    font-size: ${Math.max(6, size.heightMm < 30 ? 6.5 : 7.5)}pt;
    font-weight: 700;
    line-height: 1.05;
    text-transform: uppercase;
    max-height: 2.4em;
    overflow: hidden;
  }
  .label-gondola .g-barcode { margin: 0.5mm 0; }
  .label-gondola .g-barcode svg { width: 100% !important; max-width: ${(size.widthMm * 0.6) - 2}mm; height: auto; max-height: ${Math.min(size.heightMm * 0.35, 10)}mm; }
  .label-gondola .g-code { font-family: 'Courier New', monospace; font-size: 5pt; }
  .label-gondola .g-right {
    flex: 0 0 45%;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    padding-left: 1mm;
    line-height: 1;
  }
  .label-gondola .g-rs { font-size: ${size.heightMm < 30 ? 8 : 10}pt; font-weight: 700; margin-bottom: -1mm; }
  .label-gondola .g-price {
    font-size: ${Math.max(18, size.heightMm * 0.7)}pt;
    font-weight: 900;
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .label-gondola .g-footer {
    font-size: 5.5pt;
    padding: 0.4mm 1.5mm 0.8mm 1.5mm;
    border-top: 1px solid rgba(0,0,0,0.15);
    background: rgba(0,0,0,0.05);
    text-align: center;
  }
  .label-gondola .g-promo-ribbon {
    font-size: ${Math.max(5, size.heightMm < 30 ? 5 : 6)}pt;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    background: #000;
    color: #fff;
    text-align: center;
    padding: 0.2mm 1.5mm;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .label-gondola .g-old {
    font-size: ${Math.max(5, size.heightMm < 30 ? 5 : 6)}pt;
    color: #666;
    text-decoration: line-through;
    line-height: 1;
    margin-bottom: 0.4mm;
    white-space: nowrap;
  }
  .label-gondola .g-price-promo { color: #000; }

  @media print {
    .label { border: none; }
  }
</style></head>
<body><div class="sheet">${labels.join('')}</div></body></html>`;
  };

  const printLabels = () => {
    if (selected.length === 0) return toast.error('Nenhum produto selecionado');
    const html = buildHtml();
    document.querySelectorAll('iframe[data-labels="1"]').forEach((el) => el.remove());
    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-labels', '1');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.border = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);
    iframe.srcdoc = html;
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          toast.error('Falha ao abrir impressão: ' + (e as Error).message);
        }
        setTimeout(() => iframe.remove(), 60_000);
      }, 500);
    };
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Etiquetas"
        description="Imprima etiquetas com código de barras, nome e preço"
        actions={
          <>
            <Button variant="outline" onClick={clear} disabled={selected.length === 0}>
              <Trash2 className="w-4 h-4" /> Limpar
            </Button>
            <Button onClick={printLabels} disabled={selected.length === 0}>
              <Printer className="w-4 h-4" /> Imprimir ({totalLabels})
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Search & product list */}
        <Card className="lg:col-span-2 h-full flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Produtos</CardDescription>
              <Button variant="ghost" size="sm" onClick={addAllVisible} disabled={results.length === 0}>
                <Plus className="w-4 h-4" /> Adicionar todos
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, código..." className="pl-9" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto space-y-1">
            {results.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Nenhum produto</div>}
            {results.map((p) => {
              const pr = promoFor(p.id);
              const hasPromo = !!pr && pr.vr_promocao > 0 && pr.vr_promocao < Number(p.vr_venda ?? 0);
              return (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  className="w-full text-left p-2 rounded-lg hover:bg-secondary/50 transition-colors flex items-center gap-2 touch-target"
                >
                  <Package className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.nome_produto}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span>{p.cod_barra ?? 'Sem código'} · {formatCurrency(Number(p.vr_venda ?? 0))}</span>
                      {hasPromo && (
                        <span className="text-warning font-semibold">
                          → {formatCurrency(pr!.vr_promocao)}
                          {pr!.quantidade_minima > 1 && ` (${pr!.quantidade_minima}+ un)`}
                        </span>
                      )}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Selected list */}
        <Card className="lg:col-span-2 h-full flex flex-col">
          <CardHeader className="pb-3">
            <CardDescription>Selecionados ({selected.length}) · {totalLabels} etiquetas</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto space-y-2">
            {selected.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                Selecione produtos ao lado
              </div>
            )}
            {selected.map((p) => (
              <div key={p.id} className="p-2 rounded-lg bg-card border border-white/5 flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.nome_produto}</div>
                  <div className="text-[10px] text-muted-foreground">{formatCurrency(Number(p.vr_venda ?? 0))}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setQtd(p.id, p.qtd - 1)}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={p.qtd}
                    onChange={(e) => setQtd(p.id, Number(e.target.value))}
                    className="w-14 h-8 text-center tabular-nums"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setQtd(p.id, p.qtd + 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Format options */}
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-3">
            <CardDescription>Formato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="Modo de impressão">
              <Select value={printMode} onValueChange={(v) => setPrintMode(v as PrintMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">Folha A4 (várias colunas)</SelectItem>
                  <SelectItem value="bobina80">Bobina térmica 80mm</SelectItem>
                  <SelectItem value="bobina90">Bobina térmica 90mm</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tamanho da etiqueta">
              <Select value={sizeKey} onValueChange={setSizeKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIZES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <div className="text-xs uppercase tracking-wider text-muted-foreground pt-2 border-t border-white/5">Conteúdo</div>
            {[
              { key: 'name', label: 'Nome do produto', value: showName, onChange: setShowName },
              { key: 'pkg', label: 'Embalagem / unidade', value: showPackaging, onChange: setShowPackaging },
              { key: 'barcode', label: 'Código de barras', value: showBarcode, onChange: setShowBarcode },
              { key: 'code', label: 'Número do código', value: showCode, onChange: setShowCode },
              { key: 'price', label: 'Preço', value: showPrice, onChange: setShowPrice },
              { key: 'unit', label: 'Preço unitário (kg/l)', value: showUnitPrice, onChange: setShowUnitPrice },
              { key: 'promo', label: 'Aplicar promoções ativas', value: showPromo, onChange: setShowPromo },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center justify-between rounded-lg bg-black/20 p-2 cursor-pointer">
                <span className="text-sm">{opt.label}</span>
                <Switch checked={opt.value} onCheckedChange={opt.onChange} />
              </label>
            ))}
            <button
              type="button"
              onClick={() => setExpandedPreview(true)}
              className="mt-1 group relative"
              title="Clique para expandir"
            >
              <LabelPreview
                size={size}
                scale={2}
                product={selected[0] ?? results[0] ?? null}
                showName={showName}
                showBarcode={showBarcode}
                showCode={showCode}
                showPrice={showPrice}
                showPackaging={showPackaging}
                showUnitPrice={showUnitPrice}
                showPromo={showPromo}
                promo={promoFor((selected[0] ?? results[0] ?? { id: -1 }).id)}
                generateSvg={generateSvgBarcode}
              />
              <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <div className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md">
                  <Maximize2 className="w-3 h-3" /> Expandir
                </div>
              </div>
            </button>
            <div className="text-[10px] text-muted-foreground text-center">
              {size.widthMm}×{size.heightMm}mm · {printMode === 'a4' ? `${size.cols} por linha (A4)` : `bobina ${printMode === 'bobina80' ? '80' : '90'}mm`}
            </div>
          </CardContent>
        </Card>
      </div>

      {expandedPreview && (
        <ExpandedPreview
          onClose={() => setExpandedPreview(false)}
          size={size}
          printMode={printMode}
          rollWidthMm={printMode === 'bobina80' ? 80 : printMode === 'bobina90' ? 90 : 0}
          selected={selected}
          fallbackProduct={results[0] ?? null}
          showName={showName}
          showBarcode={showBarcode}
          showCode={showCode}
          showPrice={showPrice}
          showPackaging={showPackaging}
          showUnitPrice={showUnitPrice}
          showPromo={showPromo}
          promoFor={promoFor}
          generateSvg={generateSvgBarcode}
        />
      )}
    </div>
  );
}

function ExpandedPreview({
  onClose,
  size,
  printMode,
  rollWidthMm,
  selected,
  fallbackProduct,
  showName,
  showBarcode,
  showCode,
  showPrice,
  showPackaging,
  showUnitPrice,
  showPromo,
  promoFor,
  generateSvg,
}: {
  onClose: () => void;
  size: LabelSize;
  printMode: PrintMode;
  rollWidthMm: number;
  selected: Selected[];
  fallbackProduct: ProductRow | null;
  showName: boolean;
  showBarcode: boolean;
  showCode: boolean;
  showPrice: boolean;
  showPackaging: boolean;
  showUnitPrice: boolean;
  showPromo?: boolean;
  promoFor?: (id: number) => PromoTier | undefined;
  generateSvg: (code: string) => string;
}) {
  // Build list of labels for preview (up to 8)
  const previewProducts: ProductRow[] = [];
  for (const p of selected) {
    for (let i = 0; i < p.qtd && previewProducts.length < 8; i++) previewProducts.push(p);
  }
  if (previewProducts.length === 0 && fallbackProduct) previewProducts.push(fallbackProduct);

  const isRoll = printMode !== 'a4';
  // Bigger scale for expanded view
  const SCALE = 5;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isRoll ? `Bobina térmica ${rollWidthMm}mm` : 'Folha A4'} · Etiqueta {size.widthMm}×{size.heightMm}mm
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto flex justify-center bg-neutral-800 rounded-lg p-4">
          {isRoll ? (
            /* Vertical roll simulation */
            <div
              className="bg-white shadow-2xl"
              style={{ width: `${rollWidthMm * SCALE}px`, padding: '4px 0' }}
            >
              {previewProducts.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">Nenhum produto selecionado</div>
              ) : (
                previewProducts.map((p, i) => (
                  <div key={i} className="border-b border-dashed border-neutral-300 flex justify-center py-1">
                    <LabelInner
                      size={size}
                      scale={SCALE}
                      product={p}
                      showName={showName}
                      showBarcode={showBarcode}
                      showCode={showCode}
                      showPrice={showPrice}
                      showPackaging={showPackaging}
                      showUnitPrice={showUnitPrice}
                      showPromo={showPromo}
                      promo={promoFor?.(p.id)}
                      generateSvg={generateSvg}
                    />
                  </div>
                ))
              )}
            </div>
          ) : (
            /* A4 grid simulation */
            <div
              className="bg-white shadow-2xl"
              style={{
                width: `${210 * (SCALE * 0.6)}px`,
                minHeight: `${297 * (SCALE * 0.6)}px`,
                padding: `${4 * (SCALE * 0.6)}px`,
                display: 'grid',
                gridTemplateColumns: `repeat(${size.cols}, 1fr)`,
                gap: '4px',
                justifyItems: 'center',
              }}
            >
              {previewProducts.length === 0 ? (
                <div className="col-span-full p-8 text-center text-neutral-500">Nenhum produto selecionado</div>
              ) : (
                previewProducts.map((p, i) => (
                  <LabelInner
                    key={i}
                    size={size}
                    scale={SCALE * 0.6}
                    product={p}
                    showName={showName}
                    showBarcode={showBarcode}
                    showCode={showCode}
                    showPrice={showPrice}
                    showPackaging={showPackaging}
                    showUnitPrice={showUnitPrice}
                    showPromo={showPromo}
                    promo={promoFor?.(p.id)}
                    generateSvg={generateSvg}
                  />
                ))
              )}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground text-center">
          Preview simulando a saída da impressora {isRoll ? '· cada etiqueta é uma "página" separada na bobina' : '· folha A4 em grid'}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function LabelPreview({
  size,
  scale = 3,
  product,
  showName,
  showBarcode,
  showCode,
  showPrice,
  showPackaging,
  showUnitPrice,
  showPromo,
  promo,
  generateSvg,
}: {
  size: LabelSize;
  scale?: number;
  product: ProductRow | null;
  showName: boolean;
  showBarcode: boolean;
  showCode: boolean;
  showPrice: boolean;
  showPackaging: boolean;
  showUnitPrice: boolean;
  showPromo?: boolean;
  promo?: PromoTier;
  generateSvg: (code: string) => string;
}) {
  const wPx = size.widthMm * scale;
  const hPx = size.heightMm * scale;
  return (
    <div className="mt-3 rounded-lg border-dashed border-2 border-white/10 p-4 flex flex-col items-center gap-2 bg-black/20">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview em tempo real</div>
      {product ? (
        <LabelInner
          size={size}
          scale={scale}
          product={product}
          showName={showName}
          showBarcode={showBarcode}
          showCode={showCode}
          showPrice={showPrice}
          showPackaging={showPackaging}
          showUnitPrice={showUnitPrice}
          showPromo={showPromo}
          promo={promo}
          generateSvg={generateSvg}
        />
      ) : (
        <div
          className="bg-neutral-200 border border-dashed border-neutral-400 flex items-center justify-center text-neutral-500 text-xs"
          style={{ width: `${wPx}px`, height: `${hPx}px` }}
        >
          Selecione um produto
        </div>
      )}
    </div>
  );
}

function LabelInner({
  size,
  scale,
  product,
  showName,
  showBarcode,
  showCode,
  showPrice,
  showPackaging,
  showUnitPrice,
  showPromo,
  promo,
  generateSvg,
}: {
  size: LabelSize;
  scale: number;
  product: ProductRow;
  showName: boolean;
  showBarcode: boolean;
  showCode: boolean;
  showPrice: boolean;
  showPackaging: boolean;
  showUnitPrice: boolean;
  showPromo?: boolean;
  promo?: PromoTier;
  generateSvg: (code: string) => string;
}) {
  const base = Number(product.vr_venda ?? 0);
  const hasPromo = !!(showPromo && promo && promo.vr_promocao > 0 && promo.vr_promocao < base);
  const displayPrice = hasPromo ? promo!.vr_promocao : base;
  const tierHint = hasPromo && promo!.quantidade_minima > 1 ? `A partir de ${promo!.quantidade_minima} un` : '';
  const barcodeRef = useRef<HTMLDivElement>(null);
  const wPx = size.widthMm * scale;
  const hPx = size.heightMm * scale;

  const barcodeHtml = useMemo(() => {
    if (!showBarcode || !product?.cod_barra) return '';
    return generateSvg(product.cod_barra);
  }, [product?.cod_barra, showBarcode, generateSvg]);

  useEffect(() => {
    if (!barcodeRef.current) return;
    if (barcodeHtml) {
      barcodeRef.current.innerHTML = barcodeHtml;
      const svg = barcodeRef.current.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'none');
      }
    } else {
      barcodeRef.current.innerHTML = '';
    }
  }, [barcodeHtml]);

  const fontScale = (scale / 3) * 1.3;
  const unidade = (product.unidade ?? '').toUpperCase();
  const isFractional = unidade === 'KG' || unidade === 'L' || unidade === 'G' || unidade === 'ML';
  const pkgParts: string[] = [];
  if (product.inf_adicional) pkgParts.push(product.inf_adicional);
  if (product.unidade) pkgParts.push(product.unidade);
  const packaging = pkgParts.join(' · ');

  const nameSizeG = Math.max(6, size.heightMm < 30 ? 6.5 : 7.5) * fontScale;
  const priceBigPx = Math.max(18, size.heightMm * 0.7) * fontScale;
  const rsPx = (size.heightMm < 30 ? 8 : 10) * fontScale;
  const codePx = 5 * fontScale;
  const pkgPx = Math.max(5, size.heightMm < 30 ? 5 : 5.5) * fontScale;

  return (
    <div
      className="overflow-hidden flex flex-col shadow-lg"
      style={{
        width: `${wPx}px`,
        height: `${hPx}px`,
        background: '#fff',
        color: '#000',
        border: '1px solid #e5e5e5',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {hasPromo && (
        <div
          className="text-center font-black uppercase"
          style={{
            fontSize: `${Math.max(5, size.heightMm < 30 ? 5 : 6) * fontScale}px`,
            background: '#000',
            color: '#fff',
            padding: `${0.2 * scale}px ${1.5 * scale}px`,
            letterSpacing: '0.3px',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          PROMOÇÃO{tierHint && ` · ${tierHint}`}
        </div>
      )}
      <div className="flex" style={{ flex: 1, minHeight: 0, padding: `${1.2 * scale}px ${1.5 * scale}px 0 ${1.5 * scale}px` }}>
        <div className="flex flex-col justify-between" style={{ flex: 1, minWidth: 0, paddingRight: `${1 * scale}px` }}>
          {showName && (
            <div className="font-bold uppercase overflow-hidden" style={{ fontSize: `${nameSizeG}px`, lineHeight: 1.05, maxHeight: '2.4em' }}>
              {product.nome_produto}
            </div>
          )}
          {showPackaging && packaging && (
            <div style={{ fontSize: `${pkgPx}px`, color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {packaging}
            </div>
          )}
          {showBarcode && product.cod_barra && (
            <div
              ref={barcodeRef}
              style={{
                width: '100%',
                maxWidth: `${size.widthMm * 0.6 * scale}px`,
                height: `${Math.min(size.heightMm * 0.35, 10) * scale}px`,
                margin: `${0.5 * scale}px 0`,
              }}
            />
          )}
          {showCode && product.cod_barra && (
            <div style={{ fontFamily: 'Courier New, monospace', fontSize: `${codePx}px` }}>{product.cod_barra}</div>
          )}
        </div>
        <div className="flex flex-col items-end justify-center" style={{ flex: '0 0 45%', paddingLeft: `${1 * scale}px`, lineHeight: 1 }}>
          {showPrice && (
            <>
              {hasPromo && (
                <div style={{ fontSize: `${Math.max(5, size.heightMm < 30 ? 5 : 6) * fontScale}px`, color: '#666', textDecoration: 'line-through', whiteSpace: 'nowrap' }}>
                  de R$ {base.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              <div style={{ fontSize: `${rsPx}px`, fontWeight: 700, marginBottom: `${-1 * scale}px`, color: '#000' }}>R$</div>
              <div style={{ fontSize: `${priceBigPx}px`, fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1, color: '#000' }}>
                {displayPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </>
          )}
        </div>
      </div>
      {showUnitPrice && isFractional && (
        <div
          className="text-center"
          style={{
            fontSize: `${5.5 * fontScale}px`,
            padding: `${0.4 * scale}px ${1.5 * scale}px ${0.8 * scale}px ${1.5 * scale}px`,
            borderTop: '1px solid rgba(0,0,0,0.15)',
            background: 'rgba(0,0,0,0.04)',
          }}
        >
          Preço de 1 {unidade.toLowerCase()} = {formatCurrency(displayPrice)}
        </div>
      )}
    </div>
  );
}
