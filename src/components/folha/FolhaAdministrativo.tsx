import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Download, FileText, Calculator, Plus, Landmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';

type Func = {
  id: string; nome_completo: string; cpf: string | null; funcao_id: string | null; tipo_funcionario: string;
  salario_quinzenal: number; pix: string | null;
  banco: string | null; agencia: string | null; conta: string | null; tipo_conta: string | null;
  ativo: boolean;
};
type Funcao = { id: string; nome: string; tipo: string };
type Folha = {
  id: string; funcionario_id: string; periodo_inicio: string; periodo_fim: string;
  salario_quinzenal: number; dias_previstos: number; dias_presentes: number;
  faltas: number; atrasos: number; saidas_antecipadas: number;
  horas_extras: number; adicionais: number; descontos: number; valor_final: number;
};

function quinzenaAtual() {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  if (t.getDate() <= 15) return { ini: new Date(y, m, 1), fim: new Date(y, m, 15) };
  return { ini: new Date(y, m, 16), fim: new Date(y, m + 1, 0) };
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

function dadosBanc(f: Func): string {
  if (f.pix) return `PIX: ${f.pix}`;
  if (f.banco) {
    const parts = [f.banco];
    if (f.agencia) parts.push(`Ag ${f.agencia}`);
    if (f.conta) parts.push(`CC ${f.conta}`);
    if (f.tipo_conta) parts.push(`(${f.tipo_conta})`);
    return parts.join(' · ');
  }
  return '—';
}

// Paleta FEMAF (idêntica à folha docente)
const AZUL_RGB: [number, number, number] = [30, 17, 128];
const CEU_RGB: [number, number, number] = [0, 149, 232];
const AZUL_HEX = '1E1180';
const CEU_HEX = '0095E8';
const CINZA_CLARO_HEX = 'F4F4F4';
const PRETO_HEX = '111111';
const BRANCO_HEX = 'FFFFFF';
const border = {
  top: { style: 'thin', color: { rgb: 'CCCCCC' } },
  bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
  left: { style: 'thin', color: { rgb: 'CCCCCC' } },
  right: { style: 'thin', color: { rgb: 'CCCCCC' } },
} as const;

export default function FolhaAdministrativo() {
  const q = quinzenaAtual();
  const [ini, setIni] = useState(iso(q.ini));
  const [fim, setFim] = useState(iso(q.fim));
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'administrativo' | 'apoio'>('todos');
  const [list, setList] = useState<Folha[]>([]);
  const [funcs, setFuncs] = useState<Func[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteFunc, setAjusteFunc] = useState<string>('');
  const [ajuste, setAjuste] = useState<any>({ tipo: 'adicional', valor: 0, motivo: '' });
  const [ajustePeriodoIni, setAjustePeriodoIni] = useState(ini);
  const [ajustePeriodoFim, setAjustePeriodoFim] = useState(fim);

  function abrirAjuste() {
    // O ajuste vale, por padrão, para o período selecionado na tela — mas
    // fica editável, pra lançar um ajuste referente a uma quinzena já
    // fechada (ex.: desconto de uma falta de um período anterior) sem
    // precisar trocar o filtro da tela inteira pra isso.
    setAjustePeriodoIni(ini);
    setAjustePeriodoFim(fim);
    setAjusteOpen(true);
  }

  async function load() {
    const [payrollResult, employeesResult, rolesResult] = await Promise.all([
      supabase.from('folha_administrativo_apoio').select('*').eq('periodo_inicio', ini).eq('periodo_fim', fim),
      supabase.from('funcionarios_administrativos').select('id,nome_completo,cpf,funcao_id,tipo_funcionario,salario_quinzenal,pix,banco,agencia,conta,tipo_conta,escala_id,ativo,observacoes'),
      supabase.from('funcoes_administrativas').select('id, nome, tipo'),
    ]);
    const error = payrollResult.error || employeesResult.error || rolesResult.error;
    if (error) {
      toast({ title: 'Não foi possível carregar a folha', description: error.message, variant: 'destructive' });
      return;
    }
    setList((payrollResult.data as any) || []);
    setFuncs((employeesResult.data as any) || []);
    setFuncoes((rolesResult.data as any) || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ini, fim]);

  async function gerar() {
    const { error } = await supabase.rpc('gerar_folha_admin', { p_periodo_inicio: ini, p_periodo_fim: fim, p_funcionario_id: null });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Folha gerada' }); load();
  }
  async function salvarAjuste() {
    if (!ajusteFunc) return toast({ title: 'Selecione funcionário', variant: 'destructive' });
    if (ajustePeriodoFim < ajustePeriodoIni) return toast({ title: 'Período do ajuste inválido', variant: 'destructive' });
    const { error } = await supabase.from('ajustes_folha_administrativo').insert({
      funcionario_id: ajusteFunc, tipo: ajuste.tipo,
      valor: Number(ajuste.valor || 0),
      quantidade_horas: ajuste.tipo === 'hora_extra' ? Number(ajuste.qtd || 0) : null,
      motivo: ajuste.motivo, observacao: ajuste.observacao || null,
      periodo_inicio: ajustePeriodoIni, periodo_fim: ajustePeriodoFim,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Ajuste lançado', description: ajustePeriodoIni === ini && ajustePeriodoFim === fim ? undefined : 'Recalcule o período correspondente para ele valer na folha.' });
    setAjusteOpen(false); setAjuste({ tipo: 'adicional', valor: 0, motivo: '' });
    if (ajustePeriodoIni === ini && ajustePeriodoFim === fim) await gerar();
  }

  const funcaoNome = (id: string | null) => id ? (funcoes.find(f => f.id === id)?.nome ?? '—') : '—';

  const enriched = useMemo(() => list
    .map(fp => ({ ...fp, func: funcs.find(f => f.id === fp.funcionario_id) }))
    .filter(r => r.func && (tipoFiltro === 'todos' || r.func.tipo_funcionario === tipoFiltro))
  , [list, funcs, tipoFiltro]);

  const totalGeral = enriched.reduce((s, r) => s + Math.round(Number(r.valor_final) * 100), 0) / 100;
  const periodoLabel = `${format(new Date(ini + 'T12:00'), "dd 'de' MMM", { locale: ptBR })} a ${format(new Date(fim + 'T12:00'), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}`;
  const periodoCurto = `${format(new Date(ini + 'T12:00'), 'dd/MM')} – ${format(new Date(fim + 'T12:00'), 'dd/MM/yyyy')}`;
  const filenameSuffix = `${tipoFiltro === 'todos' ? 'Geral' : tipoFiltro.toUpperCase()}-${ini}_${fim}`;

  // ============== PDF (FEMAF) ==============
  async function gerarPDF(variant: 'pix' | 'bb') {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const subtitle = variant === 'bb'
      ? 'Folha de Pagamento BANCO DO BRASIL - Administrativo / Apoio (Quinzenal)'
      : 'Folha de Pagamento - Administrativo / Apoio (Quinzenal)';

    // Faixa verde — título
    doc.setFillColor(...AZUL_RGB);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO', pageW / 2, 10, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(subtitle, pageW / 2, 16, { align: 'center' });

    // Faixa azul-céu — período / emissão
    doc.setFillColor(...CEU_RGB);
    doc.rect(0, 22, pageW, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`PERÍODO: ${periodoLabel.toUpperCase()}`, 10, 27.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      pageW - 10, 27.5, { align: 'right' });

    const head = variant === 'bb'
      ? [['Nº', 'Funcionário(a)', 'CPF', 'Função', 'Setor', 'Período', 'Salário Quinz.', 'Adicionais', 'Descontos', 'Total Líquido', 'Agência', 'Conta']]
      : [['Nº', 'Funcionário(a)', 'CPF', 'Função', 'Setor', 'Período', 'Salário Quinz.', 'Adicionais', 'Descontos', 'Total Líquido', 'Chave PIX']];

    const body = enriched.map((r, i) => {
      const base = [
        String(i + 1),
        r.func!.nome_completo,
        r.func!.cpf || '—',
        funcaoNome(r.func!.funcao_id),
        r.func!.tipo_funcionario.charAt(0).toUpperCase() + r.func!.tipo_funcionario.slice(1),
        periodoCurto,
        `R$ ${Number(r.salario_quinzenal).toFixed(2)}`,
        `R$ ${Number(r.adicionais).toFixed(2)}`,
        `R$ ${Number(r.descontos).toFixed(2)}`,
        `R$ ${Number(r.valor_final).toFixed(2)}`,
      ];
      return variant === 'bb'
        ? [...base, r.func!.agencia || '—', r.func!.conta || '—']
        : [...base, r.func!.pix || '—'];
    });

    const foot = [[
      '', '', '', '', '', '', '', '', 'TOTAL GERAL:',
      `R$ ${totalGeral.toFixed(2)}`,
      `${enriched.length} func.`,
      ...(variant === 'bb' ? [''] : []),
    ]];

    autoTable(doc, {
      startY: 36,
      head,
      body,
      foot,
      headStyles: { fillColor: AZUL_RGB, textColor: 255, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: AZUL_RGB, textColor: 255, fontStyle: 'bold', halign: 'right' },
      bodyStyles: { fontSize: 8, cellPadding: 1.8 },
      alternateRowStyles: { fillColor: [244, 244, 244] },
      columnStyles: variant === 'bb' ? {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 40 },
        2: { halign: 'center', cellWidth: 26 },
        3: { cellWidth: 26 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 22 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 18 },
        8: { halign: 'right', cellWidth: 18 },
        9: { halign: 'right', cellWidth: 22, fontStyle: 'bold' },
        10: { halign: 'center', cellWidth: 16 },
        11: { halign: 'center', cellWidth: 20 },
      } : {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 44 },
        2: { halign: 'center', cellWidth: 28 },
        3: { cellWidth: 30 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 24 },
        6: { halign: 'right', cellWidth: 22 },
        7: { halign: 'right', cellWidth: 20 },
        8: { halign: 'right', cellWidth: 20 },
        9: { halign: 'right', cellWidth: 24, fontStyle: 'bold' },
        10: { cellWidth: 40, fontSize: 7 },
      },
      margin: { left: 8, right: 8 },
      didDrawPage: (data) => {
        const ph = doc.internal.pageSize.getHeight();
        doc.setFontSize(8); doc.setTextColor(120, 120, 120);
        doc.text(`Documento gerado eletronicamente — FEMAF • Página ${data.pageNumber}`,
          pageW / 2, ph - 6, { align: 'center' });
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 18;
    if (finalY < doc.internal.pageSize.getHeight() - 30) {
      const signW = 70;
      doc.setDrawColor(0, 0, 0);
      doc.line(20, finalY, 20 + signW, finalY);
      doc.line(pageW - 20 - signW, finalY, pageW - 20, finalY);
      doc.setFontSize(9); doc.setTextColor(50, 50, 50);
      doc.text('Coordenação Administrativa', 20 + signW / 2, finalY + 5, { align: 'center' });
      doc.text('Diretoria Financeira', pageW - 20 - signW / 2, finalY + 5, { align: 'center' });
    }

    const prefix = variant === 'bb' ? 'Folha-Administrativo-BB-FEMAF' : 'Folha-Administrativo-FEMAF';
    doc.save(`${prefix}-${filenameSuffix}.pdf`);
  }

  // ============== Excel (FEMAF) ==============
  async function gerarExcel(variant: 'pix' | 'bb') {
    const { default: XLSX } = await import('xlsx-js-style');
    const titleStyle = { font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: BRANCO_HEX } }, fill: { fgColor: { rgb: AZUL_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const subtitleStyle = { font: { name: 'Calibri', sz: 11, italic: true, color: { rgb: BRANCO_HEX } }, fill: { fgColor: { rgb: AZUL_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const periodoStyle = { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: PRETO_HEX } }, fill: { fgColor: { rgb: CEU_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const headerStyle = { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: BRANCO_HEX } }, fill: { fgColor: { rgb: AZUL_HEX } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border };
    const cellBase = { font: { name: 'Calibri', sz: 10, color: { rgb: PRETO_HEX } }, alignment: { vertical: 'center', wrapText: true }, border };
    const cellAlt = { ...cellBase, fill: { fgColor: { rgb: CINZA_CLARO_HEX } } };
    const moneyFmt = 'R$ #,##0.00;[Red](R$ #,##0.00)';

    const headers = variant === 'bb'
      ? ['Nº', 'Funcionário(a)', 'CPF', 'Função', 'Setor', 'Período', 'Salário Quinz.', 'Adicionais', 'Descontos', 'Total Líquido', 'Agência', 'Conta']
      : ['Nº', 'Funcionário(a)', 'CPF', 'Função', 'Setor', 'Período', 'Salário Quinz.', 'Adicionais', 'Descontos', 'Total Líquido', 'Chave PIX'];
    const lastCol = headers.length - 1;

    const subtitle = variant === 'bb'
      ? 'Folha de Pagamento BANCO DO BRASIL - Administrativo / Apoio (Quinzenal)'
      : 'Folha de Pagamento - Administrativo / Apoio (Quinzenal)';

    const wb = XLSX.utils.book_new();
    const ws: any = {};
    const merges: any[] = [];
    const setCell = (addr: string, v: any, s?: any, z?: string) => {
      ws[addr] = { v, t: typeof v === 'number' ? 'n' : 's', s, ...(z ? { z } : {}) };
    };

    setCell('A1', 'FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO', titleStyle);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
    setCell('A2', subtitle, subtitleStyle);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
    setCell('A3', `Período: ${periodoLabel.toUpperCase()}`, periodoStyle);
    const periodoEnd = Math.max(5, Math.floor(lastCol / 2));
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: periodoEnd } });
    setCell(XLSX.utils.encode_cell({ r: 2, c: periodoEnd + 1 }), `Emissão: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: PRETO_HEX } },
      fill: { fgColor: { rgb: CEU_HEX } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
    merges.push({ s: { r: 2, c: periodoEnd + 1 }, e: { r: 2, c: lastCol } });

    headers.forEach((h, i) => setCell(XLSX.utils.encode_cell({ r: 3, c: i }), h, headerStyle));

    let row = 4;
    enriched.forEach((r, idx) => {
      const base = idx % 2 === 0 ? cellBase : cellAlt;
      const centerS = { ...base, alignment: { ...base.alignment, horizontal: 'center' } };
      const rightS = { ...base, alignment: { ...base.alignment, horizontal: 'right' } };
      const totalS = { ...rightS, font: { ...base.font, bold: true } };
      const common: [any, any?, string?][] = [
        [idx + 1, centerS],
        [r.func!.nome_completo, base],
        [r.func!.cpf || '—', centerS],
        [funcaoNome(r.func!.funcao_id), base],
        [r.func!.tipo_funcionario.charAt(0).toUpperCase() + r.func!.tipo_funcionario.slice(1), centerS],
        [periodoCurto, centerS],
        [Number(r.salario_quinzenal), rightS, moneyFmt],
        [Number(r.adicionais), rightS, moneyFmt],
        [Number(r.descontos), rightS, moneyFmt],
        [Number(r.valor_final), totalS, moneyFmt],
      ];
      const tail: [any, any?, string?][] = variant === 'bb'
        ? [[r.func!.agencia || '—', centerS], [r.func!.conta || '—', centerS]]
        : [[r.func!.pix || '—', { ...base, font: { ...base.font, sz: 9 } }]];
      [...common, ...tail].forEach((d, ci) => setCell(XLSX.utils.encode_cell({ r: row, c: ci }), d[0], d[1], d[2]));
      row++;
    });

    // TOTAL GERAL
    const totalLabelStyle = { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: BRANCO_HEX } }, fill: { fgColor: { rgb: AZUL_HEX } }, alignment: { horizontal: 'right', vertical: 'center' }, border };
    const totalValueStyle = { font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: BRANCO_HEX } }, fill: { fgColor: { rgb: AZUL_HEX } }, alignment: { horizontal: 'right', vertical: 'center' }, border };
    setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), 'TOTAL GERAL', totalLabelStyle);
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 8 } });
    setCell(XLSX.utils.encode_cell({ r: row, c: 9 }), Number(totalGeral), totalValueStyle, moneyFmt);
    setCell(XLSX.utils.encode_cell({ r: row, c: 10 }), `${enriched.length} func.`, { ...totalLabelStyle, alignment: { horizontal: 'center', vertical: 'center' } });
    if (lastCol > 10) merges.push({ s: { r: row, c: 10 }, e: { r: row, c: lastCol } });
    row += 2;

    // Assinaturas
    const assinaturaStyle = {
      font: { name: 'Calibri', sz: 10, color: { rgb: PRETO_HEX } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: PRETO_HEX } } },
    };
    const mid = Math.floor(lastCol / 2);
    setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), 'Coordenação Administrativa', assinaturaStyle);
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: mid - 1 } });
    setCell(XLSX.utils.encode_cell({ r: row, c: mid + 1 }), 'Diretoria Financeira', assinaturaStyle);
    merges.push({ s: { r: row, c: mid + 1 }, e: { r: row, c: lastCol } });

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: lastCol } });
    ws['!merges'] = merges;
    ws['!cols'] = variant === 'bb'
      ? [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }]
      : [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 26 }, { wch: 16 }, { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 28 }];
    ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 22 }, { hpt: 32 }];
    (ws as any)['!freeze'] = { xSplit: 0, ySplit: 4 };

    XLSX.utils.book_append_sheet(wb, ws, variant === 'bb' ? 'Folha BB Adm' : 'Folha Adm');
    const prefix = variant === 'bb' ? 'Folha-Administrativo-BB-FEMAF' : 'Folha-Administrativo-FEMAF';
    XLSX.writeFile(wb, `${prefix}-${filenameSuffix}.xlsx`);
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Início</Label>
              <Input type="date" value={ini} onChange={e => setIni(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fim</Label>
              <Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</Label>
              <Select value={tipoFiltro} onValueChange={(v: any) => setTipoFiltro(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="administrativo">Administrativo</SelectItem>
                  <SelectItem value="apoio">Apoio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={gerar} className="w-full gap-1"><Calculator size={14} /> Gerar/Recalcular</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="text-sm text-muted-foreground">{enriched.length} funcionário(s) • R$ {totalGeral.toFixed(2)}</p>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={ajusteOpen} onOpenChange={(open) => open ? abrirAjuste() : setAjusteOpen(false)}>
            <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1"><Plus size={14} /> Ajuste</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Lançar ajuste</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Funcionário</Label>
                  <Select value={ajusteFunc} onValueChange={setAjusteFunc}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{funcs.filter(f => f.ativo).map(f => <SelectItem key={f.id} value={f.id}>{f.nome_completo}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Período — início</Label>
                    <Input type="date" value={ajustePeriodoIni} onChange={e => setAjustePeriodoIni(e.target.value)} />
                  </div>
                  <div>
                    <Label>Período — fim</Label>
                    <Input type="date" value={ajustePeriodoFim} onChange={e => setAjustePeriodoFim(e.target.value)} />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground -mt-2">
                  A quinzena a que este ajuste se refere — já vem preenchida com o período selecionado na tela. Mude aqui para lançar um ajuste de um período anterior (ex.: desconto de uma falta de uma quinzena já fechada).
                </p>
                <div>
                  <Label>Tipo</Label>
                  <Select value={ajuste.tipo} onValueChange={v => setAjuste({ ...ajuste, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adicional">Adicional</SelectItem>
                      <SelectItem value="desconto">Desconto</SelectItem>
                      <SelectItem value="hora_extra">Hora extra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {ajuste.tipo === 'hora_extra' && (
                  <div><Label>Quantidade de horas</Label><Input type="number" step="0.5" value={ajuste.qtd || ''} onChange={e => setAjuste({ ...ajuste, qtd: e.target.value })} /></div>
                )}
                <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={ajuste.valor} onChange={e => setAjuste({ ...ajuste, valor: e.target.value })} /></div>
                <div><Label>Motivo</Label><Input value={ajuste.motivo} onChange={e => setAjuste({ ...ajuste, motivo: e.target.value })} /></div>
                <div><Label>Observação</Label><Textarea value={ajuste.observacao || ''} onChange={e => setAjuste({ ...ajuste, observacao: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={salvarAjuste}>Salvar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => gerarPDF('pix')} disabled={enriched.length === 0} className="gap-1">
            <FileText size={14} /> PDF
          </Button>
          <Button size="sm" onClick={() => gerarExcel('pix')} disabled={enriched.length === 0} className="gap-1">
            <Download size={14} /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => gerarPDF('bb')} disabled={enriched.length === 0} className="gap-1 border-primary/40 text-primary hover:bg-primary/10">
            <Landmark size={14} /> PDF BB
          </Button>
          <Button size="sm" onClick={() => gerarExcel('bb')} disabled={enriched.length === 0} className="gap-1 bg-primary/90 hover:bg-primary">
            <Download size={14} /> Excel BB
          </Button>
        </div>
      </div>

      {/* Mobile: cards */}
      <div className="md:hidden space-y-2">
        {enriched.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{r.func!.nome_completo}</p>
                  <Badge variant="outline" className="text-[10px] mt-0.5">{r.func!.tipo_funcionario}</Badge>
                </div>
                <p className="font-bold text-primary shrink-0">R$ {Number(r.valor_final).toFixed(2)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                <span>Salário<br /><strong className="text-foreground">R$ {Number(r.salario_quinzenal).toFixed(2)}</strong></span>
                <span>Dias<br /><strong className="text-foreground">{r.dias_previstos}/{r.dias_presentes}</strong></span>
                <span>Faltas<br /><strong className="text-foreground">{r.faltas}</strong></span>
              </div>
              <p className="text-[11px] text-muted-foreground border-t border-border pt-1.5 break-words">
                {dadosBanc(r.func!)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden md:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
              <tr>
                <th className="py-2 px-3">Funcionário</th>
                <th>Tipo</th>
                <th>Salário</th>
                <th>P/A</th>
                <th>Faltas</th>
                <th>Atr.</th>
                <th>Adic.</th>
                <th>Desc.</th>
                <th>Total</th>
                <th>Dados Bancários</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map(r => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 px-3 font-medium">{r.func!.nome_completo}</td>
                  <td><Badge variant="outline" className="text-[10px]">{r.func!.tipo_funcionario}</Badge></td>
                  <td>R$ {Number(r.salario_quinzenal).toFixed(2)}</td>
                  <td>{r.dias_previstos}/{r.dias_presentes}</td>
                  <td>{r.faltas}</td>
                  <td>{r.atrasos}</td>
                  <td>R$ {Number(r.adicionais).toFixed(2)}</td>
                  <td>R$ {Number(r.descontos).toFixed(2)}</td>
                  <td className="font-bold text-primary">R$ {Number(r.valor_final).toFixed(2)}</td>
                  <td className="text-xs max-w-[250px] truncate" title={dadosBanc(r.func!)}>
                    {dadosBanc(r.func!)}
                  </td>
                </tr>
              ))}
              {enriched.length === 0 && (
                <tr><td colSpan={10} className="py-6 text-center text-muted-foreground">
                  Gere a folha para o período selecionado.
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
