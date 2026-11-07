import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, UserX, RefreshCcw, FileDown, Calculator, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import FolhaAdministrativo from '@/components/folha/FolhaAdministrativo';
import { useConfirm } from '@/hooks/useConfirm';

type Funcao = { id: string; nome: string; tipo: string; descricao: string | null; ativo: boolean };
type Escala = {
  id: string; nome: string; dias_semana: number[];
  entrada_prevista: string | null; saida_intervalo_prevista: string | null;
  retorno_intervalo_previsto: string | null; saida_prevista: string | null;
  intervalo_minutos: number; ativo: boolean;
};
type Func = {
  id: string; nome_completo: string; cpf: string | null; funcao_id: string | null; tipo_funcionario: string;
  salario_quinzenal: number; pin?: string; tem_pin?: boolean; pix: string | null;
  banco: string | null; agencia: string | null; conta: string | null; tipo_conta: string | null;
  escala_id: string | null; ativo: boolean; observacoes: string | null;
};
type Reg = {
  id: string; funcionario_id: string; data: string; tipo_marcacao: string;
  horario_previsto: string | null; horario_real: string; diferenca_minutos: number | null;
  status: string | null; justificativa: string | null;
};
type Folha = {
  id: string; funcionario_id: string; periodo_inicio: string; periodo_fim: string;
  salario_quinzenal: number; dias_previstos: number; dias_presentes: number;
  faltas: number; atrasos: number; saidas_antecipadas: number;
  horas_extras: number; adicionais: number; descontos: number; valor_final: number;
  observacoes: string | null; status: string;
};

const TIPO_LABEL: Record<string,string> = {
  entrada_expediente: 'Entrada',
  saida_intervalo: 'Saída intervalo',
  retorno_intervalo: 'Retorno intervalo',
  saida_expediente: 'Saída',
};

// Layout institucional FEMAF — espelhado da folha premium dos professores.
const FEMAF_PRIMARIA_RGB: [number, number, number] = [30, 17, 128];
const FEMAF_DESTAQUE_RGB: [number, number, number] = [0, 149, 232];
const FEMAF_PRIMARIA_HEX = '1E1180';
const FEMAF_DESTAQUE_HEX = '0095E8';
const FEMAF_CINZA_HEX = 'F4F4F4';
const FEMAF_PRETO_HEX = '111111';
const FEMAF_BRANCO_HEX = 'FFFFFF';
const FEMAF_BORDER = {
  top: { style: 'thin', color: { rgb: 'CCCCCC' } },
  bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
  left: { style: 'thin', color: { rgb: 'CCCCCC' } },
  right: { style: 'thin', color: { rgb: 'CCCCCC' } },
} as const;

function dataBR(date: string) {
  return new Date(`${date}T12:00`).toLocaleDateString('pt-BR');
}

function dataHoraBR(date: string) {
  return new Date(date).toLocaleString('pt-BR');
}

export default function Administrativo() {
  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Administrativo / Apoio</h1>
        <p className="text-sm text-muted-foreground">Gestão de funcionários, escalas, ponto e folha quinzenal</p>
      </motion.div>
      <Tabs defaultValue="funcionarios" className="w-full">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar md:grid md:grid-cols-6">
          <TabsTrigger value="funcionarios" className="shrink-0">Funcionários</TabsTrigger>
          <TabsTrigger value="funcoes" className="shrink-0">Cargos</TabsTrigger>
          <TabsTrigger value="escalas" className="shrink-0">Escalas</TabsTrigger>
          <TabsTrigger value="registros" className="shrink-0">Registros</TabsTrigger>
          <TabsTrigger value="folha" className="shrink-0">Folha</TabsTrigger>
          <TabsTrigger value="relatorios" className="shrink-0">Relatórios</TabsTrigger>
        </TabsList>
        <TabsContent value="funcionarios"><TabFuncionarios /></TabsContent>
        <TabsContent value="funcoes"><TabFuncoes /></TabsContent>
        <TabsContent value="escalas"><TabEscalas /></TabsContent>
        <TabsContent value="registros"><TabRegistros /></TabsContent>
        <TabsContent value="folha"><FolhaAdministrativo /></TabsContent>
        <TabsContent value="relatorios"><TabRelatorios /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============ FUNCIONÁRIOS ============ */
function TabFuncionarios() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [list, setList] = useState<Func[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [edit, setEdit] = useState<Partial<Func> | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const [a, b, c] = await Promise.all([
      supabase.from('funcionarios_administrativos').select('id,nome_completo,cpf,funcao_id,tipo_funcionario,salario_quinzenal,pix,banco,agencia,conta,tipo_conta,escala_id,ativo,observacoes').order('nome_completo'),
      supabase.from('funcoes_administrativas').select('*').order('nome'),
      supabase.from('escalas_administrativas').select('*').order('nome'),
    ]);
    if (a.error || b.error || c.error) {
      toast({ title: 'Não foi possível carregar os funcionários', description: a.error?.message || b.error?.message || c.error?.message, variant: 'destructive' });
      return;
    }
    setList((a.data as any) || []);
    setFuncoes((b.data as any) || []);
    setEscalas((c.data as any) || []);
  }
  useEffect(() => { load(); }, []);

  async function salvar() {
    if (!edit?.nome_completo) { toast({ title: 'Nome obrigatório', variant: 'destructive' }); return; }
    const { tem_pin: _tem_pin, pin, ...rest } = edit;
    // Em branco na edição mantém o PIN atual (nunca é buscado do servidor).
    const payload = { ...rest, salario_quinzenal: Number(edit.salario_quinzenal || 0), ...(pin ? { pin } : {}) };
    const { error } = edit.id
      ? await supabase.from('funcionarios_administrativos').update(payload).eq('id', edit.id)
      : await supabase.from('funcionarios_administrativos').insert(payload as any);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Salvo' });
    setOpen(false); setEdit(null); load();
  }

  async function desativar(id: string) {
    if (!(await confirm('Desativar funcionário? Os pontos e folhas anteriores serão mantidos.', { danger: true, confirmLabel: 'Desativar' }))) return;
    const { error } = await supabase.from('funcionarios_administrativos').update({ ativo: false }).eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Funcionário desativado', description: 'Os registros de ponto e as folhas foram preservados.' });
    load();
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Funcionários</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEdit({ tipo_funcionario: 'administrativo', ativo: true, salario_quinzenal: 0 })}>
              <Plus size={16} /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{edit?.id ? 'Editar' : 'Novo'} funcionário</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Nome completo *</Label>
                <Input value={edit?.nome_completo || ''} onChange={e => setEdit({ ...edit, nome_completo: e.target.value })} />
              </div>
              <div>
                <Label>CPF</Label>
                <Input value={edit?.cpf || ''} onChange={e => setEdit({ ...edit, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div>
                <Label>Função</Label>
                <Select value={edit?.funcao_id || ''} onValueChange={v => setEdit({ ...edit, funcao_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{funcoes.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={edit?.tipo_funcionario || 'administrativo'} onValueChange={v => setEdit({ ...edit, tipo_funcionario: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                    <SelectItem value="apoio">Apoio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Salário quinzenal (R$)</Label>
                <Input type="number" step="0.01" value={edit?.salario_quinzenal ?? 0} onChange={e => setEdit({ ...edit, salario_quinzenal: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Escala</Label>
                <Select value={edit?.escala_id || ''} onValueChange={v => setEdit({ ...edit, escala_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{escalas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={edit?.pin || ''}
                  onChange={e => setEdit({ ...edit, pin: e.target.value.replace(/\D/g,'').slice(0,6) })}
                  placeholder={edit?.id ? 'Deixe em branco para manter' : '4 a 6 dígitos'}
                />
              </div>
              <div>
                <Label>Pix</Label>
                <Input value={edit?.pix || ''} onChange={e => setEdit({ ...edit, pix: e.target.value })} />
              </div>
              <div>
                <Label>Banco</Label>
                <Input value={edit?.banco || ''} onChange={e => setEdit({ ...edit, banco: e.target.value })} placeholder="Ex: Banco do Brasil" />
              </div>
              <div>
                <Label>Agência</Label>
                <Input value={edit?.agencia || ''} onChange={e => setEdit({ ...edit, agencia: e.target.value })} />
              </div>
              <div>
                <Label>Conta</Label>
                <Input value={edit?.conta || ''} onChange={e => setEdit({ ...edit, conta: e.target.value })} />
              </div>
              <div>
                <Label>Tipo de conta</Label>
                <Select value={edit?.tipo_conta || ''} onValueChange={v => setEdit({ ...edit, tipo_conta: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="salario">Salário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Observações</Label>
                <Textarea value={edit?.observacoes || ''} onChange={e => setEdit({ ...edit, observacoes: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({ ...edit, ativo: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
            <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Nome</th><th>CPF</th><th>Função</th><th>Tipo</th><th>Salário</th><th>Escala</th><th>Ativo</th><th></th></tr>
            </thead>
            <tbody>
              {list.map(f => (
                <tr key={f.id} className="border-t border-border">
                  <td className="py-2">{f.nome_completo}</td>
                  <td className="text-xs text-muted-foreground">{f.cpf || '—'}</td>
                  <td>{funcoes.find(x => x.id === f.funcao_id)?.nome || '—'}</td>
                  <td><Badge variant="outline">{f.tipo_funcionario}</Badge></td>
                  <td>R$ {Number(f.salario_quinzenal).toFixed(2)}</td>
                  <td>{escalas.find(x => x.id === f.escala_id)?.nome || '—'}</td>
                  <td>{f.ativo ? '✓' : '—'}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setEdit({ ...f, pin: '' }); setOpen(true); }}><Pencil size={14} /></Button>
                     {f.ativo && <Button size="sm" variant="ghost" title="Desativar sem apagar o histórico" aria-label={`Desativar ${f.nome_completo}`} onClick={() => desativar(f.id)}><UserX size={14} /></Button>}
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Nenhum funcionário cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
      {ConfirmDialog}
    </Card>
  );
}

/* ============ FUNÇÕES/CARGOS ============ */
function TabFuncoes() {
  const [list, setList] = useState<Funcao[]>([]);
  const [edit, setEdit] = useState<Partial<Funcao> | null>(null);
  const [open, setOpen] = useState(false);
  async function load() {
    const { data } = await supabase.from('funcoes_administrativas').select('*').order('nome');
    setList((data as any) || []);
  }
  useEffect(() => { load(); }, []);
  async function salvar() {
    if (!edit?.nome) return toast({ title: 'Nome obrigatório', variant: 'destructive' });
    const payload = { ...edit };
    const { error } = edit.id
      ? await supabase.from('funcoes_administrativas').update(payload).eq('id', edit.id)
      : await supabase.from('funcoes_administrativas').insert(payload as any);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Salvo' }); setOpen(false); setEdit(null); load();
  }
  async function excluir(id: string) {
    if (!confirm('Excluir?')) return;
    const { error } = await supabase.from('funcoes_administrativas').delete().eq('id', id);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    load();
  }
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Cargos / Funções</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={() => setEdit({ tipo: 'administrativo', ativo: true })}><Plus size={16}/> Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit?.id ? 'Editar' : 'Novo'} cargo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={edit?.nome || ''} onChange={e => setEdit({ ...edit, nome: e.target.value })}/></div>
              <div>
                <Label>Tipo</Label>
                <Select value={edit?.tipo || 'administrativo'} onValueChange={v => setEdit({ ...edit, tipo: v })}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrativo">Administrativo</SelectItem>
                    <SelectItem value="apoio">Apoio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Textarea value={edit?.descricao || ''} onChange={e => setEdit({ ...edit, descricao: e.target.value })}/></div>
              <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({...edit, ativo: v})}/><Label>Ativo</Label></div>
            </div>
            <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {list.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="font-medium">{f.nome} <Badge variant="outline" className="ml-2">{f.tipo}</Badge></p>
                {f.descricao && <p className="text-xs text-muted-foreground">{f.descricao}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEdit(f); setOpen(true); }}><Pencil size={14}/></Button>
                <Button size="sm" variant="ghost" onClick={() => excluir(f.id)}><Trash2 size={14}/></Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ ESCALAS ============ */
function TabEscalas() {
  const [list, setList] = useState<Escala[]>([]);
  const [edit, setEdit] = useState<Partial<Escala> | null>(null);
  const [open, setOpen] = useState(false);
  async function load() {
    const { data } = await supabase.from('escalas_administrativas').select('*').order('nome');
    setList((data as any) || []);
  }
  useEffect(() => { load(); }, []);
  async function salvar() {
    if (!edit?.nome) return toast({ title: 'Nome obrigatório', variant: 'destructive' });
    const payload: any = {
      nome: edit.nome,
      dias_semana: edit.dias_semana || [1,2,3,4,5],
      entrada_prevista: edit.entrada_prevista || null,
      saida_intervalo_prevista: edit.saida_intervalo_prevista || null,
      retorno_intervalo_previsto: edit.retorno_intervalo_previsto || null,
      saida_prevista: edit.saida_prevista || null,
      intervalo_minutos: Number(edit.intervalo_minutos || 60),
      ativo: edit.ativo ?? true,
    };
    const { error } = edit.id
      ? await supabase.from('escalas_administrativas').update(payload).eq('id', edit.id)
      : await supabase.from('escalas_administrativas').insert(payload);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Salvo' }); setOpen(false); setEdit(null); load();
  }
  async function excluir(id: string) {
    if (!confirm('Excluir?')) return;
    await supabase.from('escalas_administrativas').delete().eq('id', id);
    load();
  }
  function toggleDia(d: number) {
    const cur = edit?.dias_semana || [];
    setEdit({ ...edit, dias_semana: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d].sort() });
  }
  const DIAS = [['Dom',0],['Seg',1],['Ter',2],['Qua',3],['Qui',4],['Sex',5],['Sáb',6]] as const;
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Escalas de trabalho</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={() => setEdit({ ativo: true, dias_semana: [1,2,3,4,5], intervalo_minutos: 60 })}><Plus size={16}/> Nova</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit?.id ? 'Editar' : 'Nova'} escala</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={edit?.nome || ''} onChange={e => setEdit({...edit, nome: e.target.value})}/></div>
              <div>
                <Label>Dias da semana</Label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {DIAS.map(([l, n]) => {
                    const sel = (edit?.dias_semana || []).includes(n as number);
                    return <button key={n} type="button" onClick={() => toggleDia(n as number)}
                      className={`px-3 py-1 rounded-md border text-xs font-semibold ${sel ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border'}`}>{l}</button>;
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Entrada</Label><Input type="time" value={edit?.entrada_prevista || ''} onChange={e => setEdit({...edit, entrada_prevista: e.target.value})}/></div>
                <div><Label>Saída intervalo</Label><Input type="time" value={edit?.saida_intervalo_prevista || ''} onChange={e => setEdit({...edit, saida_intervalo_prevista: e.target.value})}/></div>
                <div><Label>Retorno intervalo</Label><Input type="time" value={edit?.retorno_intervalo_previsto || ''} onChange={e => setEdit({...edit, retorno_intervalo_previsto: e.target.value})}/></div>
                <div><Label>Saída</Label><Input type="time" value={edit?.saida_prevista || ''} onChange={e => setEdit({...edit, saida_prevista: e.target.value})}/></div>
                <div><Label>Intervalo (min)</Label><Input type="number" value={edit?.intervalo_minutos ?? 60} onChange={e => setEdit({...edit, intervalo_minutos: Number(e.target.value)})}/></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={edit?.ativo ?? true} onCheckedChange={v => setEdit({...edit, ativo: v})}/><Label>Ativa</Label></div>
            </div>
            <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {list.map(e => (
            <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="font-medium">{e.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {e.entrada_prevista?.slice(0,5)} → {e.saida_intervalo_prevista?.slice(0,5)} / {e.retorno_intervalo_previsto?.slice(0,5)} → {e.saida_prevista?.slice(0,5)} · intervalo {e.intervalo_minutos}min
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEdit(e); setOpen(true); }}><Pencil size={14}/></Button>
                <Button size="sm" variant="ghost" onClick={() => excluir(e.id)}><Trash2 size={14}/></Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ REGISTROS ============ */
function TabRegistros() {
  const today = new Date().toISOString().slice(0,10);
  const [ini, setIni] = useState(`${today.slice(0,7)}-01`);
  const [fim, setFim] = useState(today);
  const [list, setList] = useState<Reg[]>([]);
  const [funcs, setFuncs] = useState<Func[]>([]);
  async function load() {
    const [{ data: r }, { data: f }] = await Promise.all([
      supabase.from('registros_ponto_administrativo').select('*').gte('data', ini).lte('data', fim).order('horario_real', { ascending: false }),
      supabase.from('funcionarios_administrativos').select('id,nome_completo,funcao_id,tipo_funcionario,salario_quinzenal,pix,banco,agencia,conta,tipo_conta,escala_id,ativo,observacoes'),
    ]);
    setList((r as any) || []);
    setFuncs((f as any) || []);
  }
  useEffect(() => { load(); }, [ini, fim]);
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle>Registros de Ponto</CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" value={ini} onChange={e => setIni(e.target.value)} className="w-auto"/>
          <span className="text-xs">→</span>
          <Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="w-auto"/>
          <Button size="sm" variant="outline" onClick={load}><RefreshCcw size={14}/></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Data/Hora</th><th>Funcionário</th><th>Tipo</th><th>Previsto</th><th>Diff</th><th>Status</th><th>Justificativa</th></tr>
            </thead>
            <tbody>
              {list.map(r => {
                const f = funcs.find(x => x.id === r.funcionario_id);
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2">{new Date(r.horario_real).toLocaleString('pt-BR')}</td>
                    <td>{f?.nome_completo || '—'}</td>
                    <td>{TIPO_LABEL[r.tipo_marcacao] || r.tipo_marcacao}</td>
                    <td>{r.horario_previsto?.slice(0,5) || '—'}</td>
                    <td>{r.diferenca_minutos != null ? `${r.diferenca_minutos > 0 ? '+':''}${r.diferenca_minutos}m` : '—'}</td>
                    <td><Badge variant="outline">{r.status}</Badge></td>
                    <td className="text-xs text-muted-foreground max-w-[200px] truncate">{r.justificativa || '—'}</td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Sem registros no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

/* ============ RELATÓRIOS ============ */
function TabRelatorios() {
  const today = new Date().toISOString().slice(0,10);
  const [ini, setIni] = useState(`${today.slice(0,7)}-01`);
  const [fim, setFim] = useState(today);
  const [funcId, setFuncId] = useState<string>('');
  const [funcs, setFuncs] = useState<Func[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);

  useEffect(() => {
    supabase.from('funcionarios_administrativos').select('id,nome_completo,funcao_id,tipo_funcionario,salario_quinzenal,pix,banco,agencia,conta,tipo_conta,escala_id,ativo,observacoes').then(({data, error}) => {
      if (error) toast({ title: 'Não foi possível carregar os funcionários', description: error.message, variant: 'destructive' });
      else setFuncs((data as any)||[]);
    });
  }, []);

  async function gerar() {
    let q = supabase.from('registros_ponto_administrativo').select('*').gte('data', ini).lte('data', fim);
    if (funcId) q = q.eq('funcionario_id', funcId);
    const { data } = await q.order('horario_real');
    setRegs((data as any) || []);
  }

  const stats = useMemo(() => ({
    total: regs.length,
    faltas: 0,
    atrasos: regs.filter(r => r.status === 'atraso').length,
    extras: regs.filter(r => r.status === 'extra').length,
    justificativas: regs.filter(r => r.justificativa).length,
  }), [regs]);

  function exportarCSV() {
    const header = ['Data','Funcionário','Tipo','Previsto','Real','Diff','Status','Justificativa'];
    const rows = regs.map(r => {
      const f = funcs.find(x => x.id === r.funcionario_id);
      return [r.data, f?.nome_completo, TIPO_LABEL[r.tipo_marcacao] || r.tipo_marcacao,
        r.horario_previsto?.slice(0,5)||'', new Date(r.horario_real).toLocaleString('pt-BR'),
        r.diferenca_minutos, r.status, r.justificativa || ''];
    });
    const csv = [header, ...rows].map(r => r.map(c => `"${(c ?? '').toString().replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio-administrativo-${ini}_${fim}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function linhasRelatorio() {
    return regs.map((r, idx) => {
      const f = funcs.find(x => x.id === r.funcionario_id);
      const real = new Date(r.horario_real);
      return {
        n: idx + 1,
        dataHora: dataHoraBR(r.horario_real),
        funcionario: f?.nome_completo || '—',
        tipo: TIPO_LABEL[r.tipo_marcacao] || r.tipo_marcacao,
        previsto: r.horario_previsto?.slice(0, 5) || '—',
        real: Number.isNaN(real.getTime()) ? '—' : real.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        diff: r.diferenca_minutos != null ? `${r.diferenca_minutos > 0 ? '+' : ''}${r.diferenca_minutos}m` : '—',
        status: r.status || '—',
        justificativa: r.justificativa || '—',
      };
    });
  }

  async function gerarExcelRelatorio() {
    const { default: XLSX } = await import('xlsx-js-style');
    const titleStyle = { font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const subtitleStyle = { font: { name: 'Calibri', sz: 11, italic: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const periodoStyle = { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: FEMAF_PRETO_HEX } }, fill: { fgColor: { rgb: FEMAF_DESTAQUE_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const headerStyle = { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: FEMAF_BORDER };
    const cellBase = { font: { name: 'Calibri', sz: 10, color: { rgb: FEMAF_PRETO_HEX } }, alignment: { vertical: 'center', wrapText: true }, border: FEMAF_BORDER };
    const cellAlt = { ...cellBase, fill: { fgColor: { rgb: FEMAF_CINZA_HEX } } };
    const totalLabelStyle = { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'right', vertical: 'center' }, border: FEMAF_BORDER };
    const totalValueStyle = { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'center', vertical: 'center' }, border: FEMAF_BORDER };

    const wb = XLSX.utils.book_new();
    const ws: any = {};
    const merges: any[] = [];
    const setCell = (addr: string, v: any, s?: any) => {
      ws[addr] = { v, t: typeof v === 'number' ? 'n' : 's', s };
    };
    const headers = ['Nº', 'Data/Hora', 'Funcionário(a)', 'Tipo', 'Previsto', 'Real', 'Diferença', 'Status', 'Justificativa'];
    const lastCol = headers.length - 1;

    setCell('A1', 'FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO', titleStyle);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
    setCell('A2', 'Relatório de Ponto - Administrativo / Apoio', subtitleStyle);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
    setCell('A3', `Período: ${dataBR(ini)} a ${dataBR(fim)}`.toUpperCase(), periodoStyle);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 5 } });
    setCell('G3', `Emissão: ${new Date().toLocaleString('pt-BR')}`, {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: FEMAF_PRETO_HEX } },
      fill: { fgColor: { rgb: FEMAF_DESTAQUE_HEX } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
    merges.push({ s: { r: 2, c: 6 }, e: { r: 2, c: lastCol } });

    headers.forEach((h, i) => setCell(XLSX.utils.encode_cell({ r: 3, c: i }), h, headerStyle));

    let row = 4;
    linhasRelatorio().forEach((l, idx) => {
      const base = idx % 2 === 0 ? cellBase : cellAlt;
      const centerS = { ...base, alignment: { ...base.alignment, horizontal: 'center' } };
      const statusS = l.status === 'atraso'
        ? { ...centerS, font: { ...base.font, bold: true }, fill: { fgColor: { rgb: FEMAF_DESTAQUE_HEX } } }
        : centerS;
      const data: [any, any?][] = [
        [l.n, centerS], [l.dataHora, centerS], [l.funcionario, base], [l.tipo, centerS],
        [l.previsto, centerS], [l.real, centerS], [l.diff, centerS], [l.status, statusS],
        [l.justificativa, { ...base, font: { ...base.font, sz: 9 } }],
      ];
      data.forEach((d, ci) => setCell(XLSX.utils.encode_cell({ r: row, c: ci }), d[0], d[1]));
      row++;
    });

    setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), 'TOTAL DE MARCAÇÕES', totalLabelStyle);
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 5 } });
    setCell(XLSX.utils.encode_cell({ r: row, c: 6 }), stats.total, totalValueStyle);
    setCell(XLSX.utils.encode_cell({ r: row, c: 7 }), `${stats.atrasos} atraso(s)`, totalValueStyle);
    setCell(XLSX.utils.encode_cell({ r: row, c: 8 }), `${stats.justificativas} justif.`, totalValueStyle);
    row += 2;

    setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), 'RESUMO', { ...periodoStyle, alignment: { horizontal: 'left', vertical: 'center' }, border: FEMAF_BORDER });
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: lastCol } });
    row++;
    const resumoLinha = (label: string, valor: string | number) => {
      setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), label, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: FEMAF_PRETO_HEX } }, border: FEMAF_BORDER });
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 6 } });
      setCell(XLSX.utils.encode_cell({ r: row, c: 7 }), valor, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: FEMAF_PRETO_HEX } }, alignment: { horizontal: 'center' }, border: FEMAF_BORDER });
      merges.push({ s: { r: row, c: 7 }, e: { r: row, c: lastCol } });
      row++;
    };
    resumoLinha('Funcionário filtrado', funcId ? (funcs.find(f => f.id === funcId)?.nome_completo || '—') : 'Todos');
    resumoLinha('Marcações', stats.total);
    resumoLinha('Atrasos', stats.atrasos);
    resumoLinha('Horas extras', stats.extras);
    resumoLinha('Registros com justificativa', stats.justificativas);

    row += 2;
    const assinaturaStyle = { font: { name: 'Calibri', sz: 10, color: { rgb: FEMAF_PRETO_HEX } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: FEMAF_PRETO_HEX } } } };
    setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), 'Coordenação Administrativa', assinaturaStyle);
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } });
    setCell(XLSX.utils.encode_cell({ r: row, c: 5 }), 'Diretoria Financeira', assinaturaStyle);
    merges.push({ s: { r: row, c: 5 }, e: { r: row, c: lastCol } });

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: lastCol } });
    ws['!merges'] = merges;
    ws['!cols'] = [{ wch: 5 }, { wch: 21 }, { wch: 34 }, { wch: 18 }, { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 14 }, { wch: 42 }];
    ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 22 }, { hpt: 32 }];
    (ws as any)['!freeze'] = { xSplit: 0, ySplit: 4 };

    XLSX.utils.book_append_sheet(wb, ws, 'Relatório Adm');
    XLSX.writeFile(wb, `Relatorio-Administrativo-FEMAF-${ini}_${fim}.xlsx`);
  }

  async function gerarPDFRelatorio() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(...FEMAF_PRIMARIA_RGB);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO', pageW / 2, 10, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Ponto - Administrativo / Apoio', pageW / 2, 16, { align: 'center' });

    doc.setFillColor(...FEMAF_DESTAQUE_RGB);
    doc.rect(0, 22, pageW, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`PERÍODO: ${dataBR(ini)} A ${dataBR(fim)}`, 10, 27.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, pageW - 10, 27.5, { align: 'right' });

    autoTable(doc, {
      startY: 36,
      head: [['Nº', 'Data/Hora', 'Funcionário(a)', 'Tipo', 'Previsto', 'Real', 'Dif.', 'Status', 'Justificativa']],
      body: linhasRelatorio().map(l => [String(l.n), l.dataHora, l.funcionario, l.tipo, l.previsto, l.real, l.diff, l.status, l.justificativa]),
      foot: [['', '', '', '', '', 'TOTAL:', String(stats.total), `${stats.atrasos} atraso(s)`, `${stats.justificativas} justif.`]],
      headStyles: { fillColor: FEMAF_PRIMARIA_RGB, textColor: 255, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: FEMAF_PRIMARIA_RGB, textColor: 255, fontStyle: 'bold', halign: 'right' },
      bodyStyles: { fontSize: 8, cellPadding: 1.8 },
      alternateRowStyles: { fillColor: [244, 244, 244] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { halign: 'center', cellWidth: 30 },
        2: { cellWidth: 48 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 18 },
        6: { halign: 'center', cellWidth: 16 },
        7: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
        8: { cellWidth: 70, fontSize: 7 },
      },
      margin: { left: 8, right: 8 },
      didDrawPage: (data) => {
        const ph = doc.internal.pageSize.getHeight();
        doc.setFontSize(8); doc.setTextColor(120, 120, 120);
        doc.text(`Documento gerado eletronicamente — FEMAF • Página ${data.pageNumber}`, pageW / 2, ph - 6, { align: 'center' });
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

    doc.save(`Relatorio-Administrativo-FEMAF-${ini}_${fim}.pdf`);
  }

  return (
    <Card className="glass-card">
      <CardHeader><CardTitle>Relatórios</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div><Label>De</Label><Input type="date" value={ini} onChange={e => setIni(e.target.value)}/></div>
          <div><Label>Até</Label><Input type="date" value={fim} onChange={e => setFim(e.target.value)}/></div>
          <div className="min-w-[200px]">
            <Label>Funcionário (opcional)</Label>
            <Select value={funcId || 'all'} onValueChange={v => setFuncId(v === 'all' ? '' : v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {funcs.map(f => <SelectItem key={f.id} value={f.id}>{f.nome_completo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={gerar}>Gerar</Button>
          {regs.length > 0 && (
            <>
              <Button variant="outline" onClick={gerarPDFRelatorio} className="gap-1"><FileText size={14}/> PDF</Button>
              <Button onClick={gerarExcelRelatorio} className="gap-1"><Download size={14}/> Excel</Button>
              <Button variant="outline" onClick={exportarCSV} className="gap-1"><FileSpreadsheet size={14}/> CSV</Button>
            </>
          )}
        </div>
        {regs.length > 0 && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Marcações" value={stats.total}/>
              <Stat label="Atrasos" value={stats.atrasos}/>
              <Stat label="Extras" value={stats.extras}/>
              <Stat label="Com justificativa" value={stats.justificativas}/>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2">Data/Hora</th><th>Funcionário</th><th>Tipo</th><th>Status</th><th>Diff</th></tr>
                </thead>
                <tbody>
                  {regs.map(r => {
                    const f = funcs.find(x => x.id === r.funcionario_id);
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-2">{new Date(r.horario_real).toLocaleString('pt-BR')}</td>
                        <td>{f?.nome_completo}</td>
                        <td>{TIPO_LABEL[r.tipo_marcacao] || r.tipo_marcacao}</td>
                        <td><Badge variant="outline">{r.status}</Badge></td>
                        <td>{r.diferenca_minutos != null ? `${r.diferenca_minutos > 0 ? '+':''}${r.diferenca_minutos}m` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
