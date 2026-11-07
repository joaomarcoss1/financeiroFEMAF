import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { FileText, Download, Eye, EyeOff, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import logoSrc from '@/assets/logo-femaf.png';
import { CURSOS, HORARIOS } from '@/lib/types';
import { useAppSettings } from '@/hooks/useAppSettings';

// Defaults: quinzena atual (1ª se hoje ≤ 15, senão 2ª).
function defaultQuinzena(): { ini: string; fim: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const mm = String(m + 1).padStart(2, '0');
  if (now.getDate() <= 15) return { ini: `${y}-${mm}-01`, fim: `${y}-${mm}-15` };
  const ultimo = new Date(y, m + 1, 0).getDate();
  return { ini: `${y}-${mm}-16`, fim: `${y}-${mm}-${String(ultimo).padStart(2, '0')}` };
}

export default function Relatorios() {
  useAppSettings(); // hidrata CURSOS/HORARIOS reativamente
  const _def = defaultQuinzena();
  const [dataInicio, setDataInicio] = useState(_def.ini);
  const [dataFim, setDataFim] = useState(_def.fim);
  const [professorFiltro, setProfessorFiltro] = useState('todos');
  const [viewingProf, setViewingProf] = useState<string | null>(null);
  const [tab, setTab] = useState('professores');

  const [profs, setProfs] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [materias, setMaterias] = useState<any[]>([]);
  const [matsMap, setMatsMap] = useState<Record<string, string>>({});
  const [turmasMap, setTurmasMap] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, [dataInicio, dataFim]);

  async function loadData() {
    const [{ data: p, error: profError }, { data: m, error: matError }, { data: t, error: turmaError }] = await Promise.all([
      supabase.from('professores').select('id,nome,cpf,email,telefone,valor_hora_aula,chave_pix,agencia_bb,conta_bb,status,created_at'),
      supabase.from('materias').select('*'),
      supabase.from('turmas').select('id, nome'),
    ]);
    if (profError || matError || turmaError) return;
    const r: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('registros_ponto').select('*')
        .eq('status_aprovacao', 'aprovado').gte('data', dataInicio).lte('data', dataFim)
        .order('data').range(from, from + 999);
      if (error) return;
      r.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setProfs(p || []);
    setRegistros(r);
    setMaterias(m || []);
    setMatsMap(Object.fromEntries((m || []).map((x: any) => [x.id, x.nome])));
    setTurmasMap(Object.fromEntries((t || []).map((x: any) => [x.id, x.nome])));
  }

  const filteredRegistros = registros.filter(r => {
    const inRange = r.data >= dataInicio && r.data <= dataFim;
    const matchProf = professorFiltro === 'todos' || r.professor_id === professorFiltro;
    return inRange && matchProf;
  });

  const porProfessor = profs.map(p => {
    const regs = filteredRegistros.filter(r => r.professor_id === p.id);
    const totalHorarios = regs.reduce((s: number, r: any) => s + r.quantidade_horarios, 0);
    const totalValor = regs.reduce((s: number, r: any) => s + Number(r.valor_total), 0);
    return { ...p, registros: regs, totalHorarios, totalValor };
  }).filter(p => p.registros.length > 0).sort((a, b) => b.totalValor - a.totalValor);

  const totalGeral = porProfessor.reduce((s, p) => s + p.totalValor, 0);
  const totalHorasGeral = porProfessor.reduce((s, p) => s + p.totalHorarios, 0);

  // Frequency per discipline
  const porDisciplina = materias.map(mat => {
    const regs = filteredRegistros.filter(r => r.materia_id === mat.id);
    const horasMinistradas = regs.reduce((s: number, r: any) => s + r.carga_horaria, 0) / 60;
    const cargaTotal = mat.carga_horaria_total || 0;
    const percentual = cargaTotal > 0 ? Math.min((horasMinistradas / cargaTotal) * 100, 100) : 0;
    return { ...mat, regs, horasMinistradas: parseFloat(horasMinistradas.toFixed(1)), cargaTotal, percentual: parseFloat(percentual.toFixed(1)) };
  }).filter(m => m.regs.length > 0 || m.cargaTotal > 0).sort((a, b) => b.horasMinistradas - a.horasMinistradas);

  async function gerarPDF(profData?: typeof porProfessor[0]) {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const img = new Image();
    img.src = logoSrc;
    doc.addImage(img, 'PNG', 14, 8, 22, 17);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Ponto', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${format(parseISO(dataInicio), 'dd/MM/yyyy')} a ${format(parseISO(dataFim), 'dd/MM/yyyy')}`, pageWidth / 2, 27, { align: 'center' });

    let y = 35;
    const profsToShow = profData ? [profData] : porProfessor;

    profsToShow.forEach(p => {
      if (y > 230) { doc.addPage(); y = 20; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(p.nome, 14, y);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`CPF: ${p.cpf || '—'} | PIX: ${p.chave_pix || '—'} | H/A: R$ ${Number(p.valor_hora_aula).toFixed(2)}`, 14, y + 5);
      y += 12;

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Matéria', 'Turma', 'Horários', 'Horas', 'Valor']],
        body: p.registros.map((r: any) => [
          format(parseISO(r.data), 'dd/MM/yyyy'),
          matsMap[r.materia_id] || '—',
          turmasMap[r.turma_id] || '—',
          (r.horarios || []).map((h: number) => `${h}º`).join(', '),
          `${r.quantidade_horarios}h/a`,
          `R$ ${Number(r.valor_total).toFixed(2)}`,
        ]),
        foot: [['', '', '', 'TOTAL', `${p.totalHorarios}h/a`, `R$ ${p.totalValor.toFixed(2)}`]],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 100, 60] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        margin: { left: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(`PIX: ${p.chave_pix || 'Não informada'}`, 14, y);
      y += 12;
    });

    if (!profData && profsToShow.length > 1) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setDrawColor(30, 100, 60);
      doc.line(14, y, pageWidth - 14, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`TOTAL GERAL: ${totalHorasGeral}h/a — R$ ${totalGeral.toFixed(2)}`, 14, y);
    }

    doc.save(`relatorio-ponto-${format(new Date(), 'yyyyMMdd')}.pdf`);
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileText size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Relatórios e frequência</p>
        </div>
      </motion.div>

      <Card className="glass-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { const d = defaultQuinzena(); setDataInicio(d.ini); setDataFim(d.fim); }}>Quinzena atual</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => {
              const n = new Date(); const y = n.getFullYear(); const mm = String(n.getMonth() + 1).padStart(2, '0');
              const ult = new Date(y, n.getMonth() + 1, 0).getDate();
              setDataInicio(`${y}-${mm}-01`); setDataFim(`${y}-${mm}-${String(ult).padStart(2, '0')}`);
            }}>Mês atual</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => {
              setDataInicio('2000-01-01'); setDataFim(format(new Date(), 'yyyy-MM-dd'));
            }}>Tudo</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs uppercase tracking-wider text-muted-foreground">De</Label><Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs uppercase tracking-wider text-muted-foreground">Até</Label><Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="mt-1" /></div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Professor</Label>
            <Select value={professorFiltro} onValueChange={(v) => {
              setProfessorFiltro(v);
              // Ao filtrar um professor específico, amplia o período para mostrar todo o histórico dele.
              if (v !== 'todos') { setDataInicio('2000-01-01'); setDataFim(format(new Date(), 'yyyy-MM-dd')); }
            }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos (período acima)</SelectItem>
                {profs.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Por padrão exibe a quinzena atual. Escolha "Mês atual" ou "Tudo" para ampliar; selecionar um professor mostra todo o histórico dele.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="professores" className="flex-1">Professores</TabsTrigger>
          <TabsTrigger value="disciplinas" className="flex-1">Disciplinas</TabsTrigger>
        </TabsList>

        <TabsContent value="professores" className="space-y-3 mt-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {porProfessor.length} professor(es) • {totalHorasGeral}h/a • R$ {totalGeral.toFixed(2)}
            </p>
            <Button onClick={() => gerarPDF()} size="sm" className="gap-1" disabled={porProfessor.length === 0}>
              <Download size={14} /> PDF
            </Button>
          </div>

          {porProfessor.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="glass-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.registros.length} registro(s) • {p.totalHorarios}h/a</p>
                      <p className="text-sm font-bold text-primary mt-1">R$ {p.totalValor.toFixed(2)}</p>
                      {p.chave_pix && <p className="text-xs text-muted-foreground mt-1">PIX: {p.chave_pix}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => setViewingProf(viewingProf === p.id ? null : p.id)} className="gap-1 h-8">
                        {viewingProf === p.id ? <EyeOff size={13} /> : <Eye size={13} />}
                        {viewingProf === p.id ? 'Ocultar' : 'Ver'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => gerarPDF(p)} className="gap-1 h-8">
                        <Download size={13} />
                      </Button>
                    </div>
                  </div>

                  {viewingProf === p.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Matéria</TableHead>
                            <TableHead>Turma</TableHead>
                            <TableHead>Horários</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {p.registros.map((r: any) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-sm">{format(parseISO(r.data), 'dd/MM/yyyy')}</TableCell>
                              <TableCell className="text-sm">{matsMap[r.materia_id] || '—'}</TableCell>
                              <TableCell className="text-sm">{turmasMap[r.turma_id] || '—'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {(r.horarios || []).map((h: number) => (
                                    <Badge key={h} variant="secondary" className="text-[10px]">{h}º</Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">R$ {Number(r.valor_total).toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={3} className="font-bold text-right">TOTAL</TableCell>
                            <TableCell className="font-bold">{p.totalHorarios}h/a</TableCell>
                            <TableCell className="text-right font-bold text-primary">R$ {p.totalValor.toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {porProfessor.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum registro no período</p>}
        </TabsContent>

        <TabsContent value="disciplinas" className="space-y-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-primary" />
            <p className="text-sm font-medium">Frequência por Disciplina</p>
          </div>

          {porDisciplina.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-sm">{m.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {CURSOS.find(c => c.id === m.curso_id)?.nome ?? m.curso_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{m.horasMinistradas}h / {m.cargaTotal}h</p>
                      <Badge variant={m.percentual >= 75 ? 'default' : m.percentual >= 50 ? 'secondary' : 'outline'} className="text-[10px]">
                        {m.percentual}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={m.percentual} className="h-2" />
                  <p className="text-[10px] text-muted-foreground mt-1">{m.regs.length} aula(s) registrada(s)</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {porDisciplina.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhuma disciplina com registros</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
