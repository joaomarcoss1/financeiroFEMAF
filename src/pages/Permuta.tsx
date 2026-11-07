import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeftRight, Plus, LogOut, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getAppSettings, DEFAULT_SETTINGS, type AppSettings } from '@/lib/appSettings';
import { HORARIOS as HORARIOS_FALLBACK } from '@/lib/types';
import logoFemaf from '@/assets/logo-femaf.png';
import PageBackground from '@/components/PageBackground';

const SESSION_KEY = 'permuta_session';
type Sess = { id: string; nome: string; pin: string };

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente_b: { label: 'Aguardando professor', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  pendente_admin: { label: 'Aguardando aprovação', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  aprovado: { label: 'Aprovada', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  rejeitado: { label: 'Rejeitada', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
};

export default function Permuta() {
  const [sess, setSess] = useState<Sess | null>(() => {
    try { const s = sessionStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [nomeIn, setNomeIn] = useState('');
  const [pinIn, setPinIn] = useState('');
  const [logging, setLogging] = useState(false);

  async function login() {
    if (!nomeIn.trim() || !pinIn.trim()) return toast({ title: 'Preencha nome e PIN', variant: 'destructive' });
    setLogging(true);
    const { data: profs, error } = await supabase.rpc('list_professores_ativos');
    if (error) { setLogging(false); return toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
    const match = (profs || []).find((p: any) => p.nome.trim().toLowerCase() === nomeIn.trim().toLowerCase());
    if (!match) { setLogging(false); return toast({ title: 'Professor não encontrado', variant: 'destructive' }); }
    // valida pin tentando listar permutas
    const { error: e2 } = await supabase.rpc('permuta_listar' as any, { p_prof_id: match.id, p_pin: pinIn.trim() });
    setLogging(false);
    if (e2) return toast({ title: 'PIN incorreto', variant: 'destructive' });
    const s = { id: match.id, nome: match.nome, pin: pinIn.trim() };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSess(s);
  }

  function logout() { sessionStorage.removeItem(SESSION_KEY); setSess(null); }

  if (!sess) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8">
        <PageBackground />
        <div className="w-full max-w-sm mx-auto">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center space-y-2">
              <img src={logoFemaf} alt="FEMAF" className="h-14 mx-auto rounded-xl shadow-md" />
              <span className="eyebrow justify-center">
                <ArrowLeftRight size={12} /> Acesso do professor
              </span>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">Permuta de Horários</h1>
            </div>
            <Card className="premium-card">
              <CardContent className="p-6 space-y-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={nomeIn} onChange={e => setNomeIn(e.target.value)} placeholder="Seu nome" className="input-premium mt-1" />
                </div>
                <div>
                  <Label>PIN</Label>
                  <Input type="password" value={pinIn} onChange={e => setPinIn(e.target.value)} placeholder="••••" className="input-premium mt-1" />
                </div>
                <motion.div whileTap={{ scale: 0.98 }}>
                  <Button className="w-full h-11 btn-glow btn-premium" onClick={login} disabled={logging}>{logging ? 'Entrando...' : 'Entrar'}</Button>
                </motion.div>
              </CardContent>
            </Card>
            <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors">Voltar para bater ponto</Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return <Painel sess={sess} onLogout={logout} />;
}

function Painel({ sess, onLogout }: { sess: Sess; onLogout: () => void }) {
  const [permutas, setPermutas] = useState<any[]>([]);
  const [profs, setProfs] = useState<{ id: string; nome: string }[]>([]);
  const [materias, setMaterias] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [grade, setGrade] = useState<any[]>([]);
  const [cfg, setCfg] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [novaOpen, setNovaOpen] = useState(false);
  const [respondendo, setRespondendo] = useState<any | null>(null);
  const [motivoRec, setMotivoRec] = useState('');

  // Form nova permuta
  const [form, setForm] = useState({
    professor_b_id: '',
    // Minha aula (que vou ceder)
    data_a: '', horarios_a: [] as number[], materia_a_id: '', turma_a_id: '',
    // Aula do outro (que vou assumir) — A assume aula original de B
    data_b: '', horarios_b: [] as number[], materia_b_id: '', turma_b_id: '',
    observacao: '',
  });

  const HORARIOS = cfg.horarios?.length ? cfg.horarios : HORARIOS_FALLBACK;

  useEffect(() => { load(); getAppSettings().then(setCfg).catch(() => {}); }, []);

  async function load() {
    const [{ data: ps }, { data: pp }, { data: mm }, { data: tt }, { data: hh }] = await Promise.all([
      supabase.rpc('permuta_listar' as any, { p_prof_id: sess.id, p_pin: sess.pin }),
      supabase.rpc('list_professores_ativos'),
      supabase.from('materias').select('id,nome').order('nome'),
      supabase.from('turmas').select('id,nome').order('nome'),
      supabase.from('horarios_aula').select('*'),
    ]);
    setPermutas((ps || []) as any);
    setProfs(((pp || []) as any[]).filter(p => p.id !== sess.id));
    setMaterias(mm || []);
    setTurmas(tt || []);
    setGrade(hh || []);
  }

  // (grade carregada para uso futuro de auto-preenchimento)
  void grade;


  async function enviar() {
    if (!form.professor_b_id) return toast({ title: 'Escolha o outro professor', variant: 'destructive' });
    if (!form.data_a || !form.data_b) return toast({ title: 'Informe as datas', variant: 'destructive' });
    if (!form.materia_a_id || !form.turma_a_id || !form.materia_b_id || !form.turma_b_id)
      return toast({ title: 'Preencha matéria e turma de ambos os lados', variant: 'destructive' });
    if (form.horarios_a.length === 0 || form.horarios_b.length === 0)
      return toast({ title: 'Selecione os horários', variant: 'destructive' });

    const { error } = await supabase.rpc('permuta_solicitar' as any, {
      p_prof_a_id: sess.id, p_pin: sess.pin,
      p_prof_b_id: form.professor_b_id,
      p_data_a: form.data_a, p_horarios_a: form.horarios_a, p_materia_a_id: form.materia_a_id, p_turma_a_id: form.turma_a_id,
      p_data_b: form.data_b, p_horarios_b: form.horarios_b, p_materia_b_id: form.materia_b_id, p_turma_b_id: form.turma_b_id,
      p_observacao: form.observacao || null,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Solicitação enviada' });
    setNovaOpen(false);
    setForm({ professor_b_id: '', data_a: '', horarios_a: [], materia_a_id: '', turma_a_id: '',
              data_b: '', horarios_b: [], materia_b_id: '', turma_b_id: '', observacao: '' });
    load();
  }

  async function responder(permutaId: string, aceitar: boolean, motivo?: string) {
    if (!aceitar && (!motivo || motivo.trim().length < 3)) return toast({ title: 'Informe o motivo', variant: 'destructive' });
    const { error } = await supabase.rpc('permuta_responder' as any, {
      p_prof_b_id: sess.id, p_pin: sess.pin, p_permuta_id: permutaId,
      p_aceitar: aceitar, p_motivo: aceitar ? null : motivo!.trim(),
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: aceitar ? 'Permuta aceita — aguardando aprovação' : 'Permuta recusada' });
    setRespondendo(null); setMotivoRec('');
    load();
  }


  function toggleH(lado: 'a' | 'b', h: number) {
    setForm(f => {
      const k = lado === 'a' ? 'horarios_a' : 'horarios_b';
      const cur = f[k];
      return { ...f, [k]: cur.includes(h) ? cur.filter(x => x !== h) : [...cur, h] };
    });
  }

  return (
    <div className="min-h-screen relative">
      <PageBackground />
      <header className="sticky top-0 z-40 gradient-primary shadow-lg text-primary-foreground">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm leading-tight">Permuta de Horários</p>
              <p className="text-xs text-primary-foreground/60">{sess.nome}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" className="bg-primary-foreground/15 hover:bg-primary-foreground/25 text-primary-foreground border-0" onClick={() => setNovaOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" onClick={onLogout}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-3">
        {permutas.length === 0 && (
          <Card className="glass-card">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhuma permuta ainda.
            </CardContent>
          </Card>
        )}
        {permutas.map((p, i) => {
          const eOutroPendente = p.status === 'pendente_b' && p.professor_b_id === sess.id;
          const st = STATUS_LABEL[p.status] || { label: p.status, cls: 'bg-muted' };
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
              <Card className="glass-card-hover">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={st.cls}>{st.label}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><b>{p.professor_a_nome}</b> assume: {p.materia_a_nome} • {p.turma_a_nome} • {new Date(p.data_a + 'T00:00:00').toLocaleDateString('pt-BR')} • H {p.horarios_a.join(',')}</p>
                    <p><b>{p.professor_b_nome}</b> assume: {p.materia_b_nome} • {p.turma_b_nome} • {new Date(p.data_b + 'T00:00:00').toLocaleDateString('pt-BR')} • H {p.horarios_b.join(',')}</p>
                  </div>
                  {p.observacao && <p className="text-xs italic text-muted-foreground">"{p.observacao}"</p>}
                  {p.motivo_rejeicao && <p className="text-xs text-red-600">Motivo: {p.motivo_rejeicao}</p>}
                  {eOutroPendente && (
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setRespondendo(p)}>
                        <X className="h-4 w-4 mr-1" /> Recusar
                      </Button>
                      <Button size="sm" onClick={() => responder(p.id, true)}>
                        <Check className="h-4 w-4 mr-1" /> Aceitar
                      </Button>
                    </div>
                  )}

                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </main>

      {/* Dialog: nova permuta */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>Solicitar nova permuta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Outro professor</Label>
              <Select value={form.professor_b_id} onValueChange={v => setForm({ ...form, professor_b_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {profs.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 p-3 border rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Você assumirá (aula original do outro)</p>
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={form.data_a} onChange={e => setForm({ ...form, data_a: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Matéria</Label>
                  <Select value={form.materia_a_id} onValueChange={v => setForm({ ...form, materia_a_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{materias.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Turma</Label>
                  <Select value={form.turma_a_id} onValueChange={v => setForm({ ...form, turma_a_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Horários</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {HORARIOS.map(h => (
                      <Button key={h.id} type="button" size="sm"
                        variant={form.horarios_a.includes(h.id) ? 'default' : 'outline'}
                        onClick={() => toggleH('a', h.id)}>
                        {h.id}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2 p-3 border rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Outro assumirá (sua aula original)</p>
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={form.data_b} onChange={e => setForm({ ...form, data_b: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Matéria</Label>
                  <Select value={form.materia_b_id} onValueChange={v => setForm({ ...form, materia_b_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{materias.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Turma</Label>
                  <Select value={form.turma_b_id} onValueChange={v => setForm({ ...form, turma_b_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Horários</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {HORARIOS.map(h => (
                      <Button key={h.id} type="button" size="sm"
                        variant={form.horarios_b.includes(h.id) ? 'default' : 'outline'}
                        onClick={() => toggleH('b', h.id)}>
                        {h.id}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label>Observação (opcional)</Label>
              <Textarea value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} rows={2} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNovaOpen(false)}>Cancelar</Button>
              <Button onClick={enviar}>Enviar solicitação</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: recusar */}
      <Dialog open={!!respondendo} onOpenChange={o => !o && setRespondendo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar permuta</DialogTitle></DialogHeader>
          <Textarea value={motivoRec} onChange={e => setMotivoRec(e.target.value)} placeholder="Motivo..." rows={4} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRespondendo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => respondendo && responder(respondendo.id, false, motivoRec)}>Recusar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

