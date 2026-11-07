import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Search, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Professor, Materia } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useConfirm } from '@/hooks/useConfirm';
import ListSkeleton from '@/components/ListSkeleton';

export default function Professores() {
  const { cursos: CURSOS_DISPONIVEIS } = useAppSettings();
  const { confirm, ConfirmDialog } = useConfirm();
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [profMaterias, setProfMaterias] = useState<{ professor_id: string; materia_id: string }[]>([]);
  const [coordenadores, setCoordenadores] = useState<{ professor_id: string; cursos: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Professor | null>(null);
  const [form, setForm] = useState({
    nome: '', cpf: '', email: '', telefone: '',
    valorHoraAula: '', chavePix: '', agenciaBB: '', contaBB: '', status: 'ativo',
    pin: '', materiaIds: [] as string[],
    coordenador: false, coordCursos: [] as string[],
  });


  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [profResult, matResult, pmResult, coordResult] = await Promise.all([
      supabase.from('professores').select('id,nome,cpf,email,telefone,valor_hora_aula,chave_pix,agencia_bb,conta_bb,status,created_at').order('nome'),
      supabase.from('materias').select('*').order('nome'),
      supabase.from('professor_materias').select('professor_id, materia_id'),
      supabase.from('coordenadores').select('professor_id, cursos'),
    ]);
    const error = profResult.error || matResult.error || pmResult.error || coordResult.error;
    if (error) {
      toast({ title: 'Não foi possível carregar os professores', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setProfessores((profResult.data || []) as any);
    setMaterias((matResult.data || []) as any);
    setProfMaterias(pmResult.data || []);
    setCoordenadores((coordResult.data || []) as any);
    setLoading(false);
  }

  const filtered = professores.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) || (p.cpf || '').includes(search)
  );

  function getMateriaIds(profId: string) {
    return profMaterias.filter(pm => pm.professor_id === profId).map(pm => pm.materia_id);
  }
  function getCoordCursos(profId: string): string[] {
    return coordenadores.find(c => c.professor_id === profId)?.cursos || [];
  }

  function openNew() {
    setEditing(null);
    setForm({ nome: '', cpf: '', email: '', telefone: '', valorHoraAula: '', chavePix: '', agenciaBB: '', contaBB: '', status: 'ativo', pin: '', materiaIds: [], coordenador: false, coordCursos: [] });
    setDialogOpen(true);
  }

  function openEdit(p: Professor) {
    setEditing(p);
    const cc = getCoordCursos(p.id);
    setForm({
      nome: p.nome, cpf: p.cpf || '', email: p.email || '', telefone: p.telefone || '',
      valorHoraAula: String(p.valor_hora_aula), chavePix: p.chave_pix || '',
      agenciaBB: (p as any).agencia_bb || '', contaBB: (p as any).conta_bb || '',
      // PIN nunca é buscado do servidor (fica só o hash lá). Campo começa
      // vazio; só é enviado no salvar se o admin digitar um novo valor.
      status: p.status, pin: '', materiaIds: getMateriaIds(p.id),
      coordenador: cc.length > 0, coordCursos: cc,
    });

    setDialogOpen(true);
  }

  async function saveCoordenador(profId: string) {
    if (form.coordenador && form.coordCursos.length > 0) {
      await supabase.from('coordenadores').upsert({ professor_id: profId, cursos: form.coordCursos }, { onConflict: 'professor_id' });
    } else {
      await supabase.from('coordenadores').delete().eq('professor_id', profId);
    }
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast({ title: 'Nome é obrigatório', variant: 'destructive' }); return; }
    const jaTemPin = !!form.pin || !!(editing && getCoordCursos(editing.id).length > 0);
    if (form.coordenador && !jaTemPin) { toast({ title: 'Coordenador precisa de PIN', description: 'O acesso de coordenador exige PIN cadastrado.', variant: 'destructive' }); return; }
    if (form.coordenador && form.coordCursos.length === 0) { toast({ title: 'Selecione ao menos 1 curso para o coordenador', variant: 'destructive' }); return; }
    const valor = parseFloat(form.valorHoraAula) || 0;

    if (editing) {
      const { error } = await supabase.from('professores').update({
        nome: form.nome, cpf: form.cpf || null, email: form.email || null,
        telefone: form.telefone || null, valor_hora_aula: valor,
        chave_pix: form.chavePix || null, status: form.status,
        // Só inclui o PIN no update se o admin digitou um novo — em branco
        // mantém o PIN existente (que já não é mais visível aqui).
        ...(form.pin ? { pin: form.pin } : {}),
        agencia_bb: form.agenciaBB || null, conta_bb: form.contaBB || null,
      } as any).eq('id', editing.id);

      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }

      await supabase.from('professor_materias').delete().eq('professor_id', editing.id);
      if (form.materiaIds.length > 0) {
        await supabase.from('professor_materias').insert(
          form.materiaIds.map(mid => ({ professor_id: editing.id, materia_id: mid }))
        );
      }
      await saveCoordenador(editing.id);
      toast({ title: 'Professor atualizado!' });
    } else {
      const { data: newProf, error } = await supabase.from('professores').insert({
        nome: form.nome, cpf: form.cpf || null, email: form.email || null,
        telefone: form.telefone || null, valor_hora_aula: valor,
        chave_pix: form.chavePix || null, status: form.status, pin: form.pin || null,
        agencia_bb: form.agenciaBB || null, conta_bb: form.contaBB || null,
      } as any).select().single();

      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }

      if (form.materiaIds.length > 0 && newProf) {
        await supabase.from('professor_materias').insert(
          form.materiaIds.map(mid => ({ professor_id: newProf.id, materia_id: mid }))
        );
      }
      if (newProf) await saveCoordenador(newProf.id);
      toast({ title: 'Professor cadastrado!' });
    }
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!(await confirm('Deseja excluir este professor?', { danger: true, confirmLabel: 'Excluir' }))) return;
    await supabase.from('professores').delete().eq('id', id);
    toast({ title: 'Professor removido' });
    loadData();
  }

  function toggleMateria(id: string) {
    setForm(f => ({
      ...f, materiaIds: f.materiaIds.includes(id) ? f.materiaIds.filter(m => m !== id) : [...f.materiaIds, id],
    }));
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Professores</h1>
          <p className="text-muted-foreground text-sm">{professores.length} cadastrado(s)</p>
        </div>
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button onClick={openNew} className="gap-2"><Plus size={16} /> Novo</Button>
        </motion.div>
      </motion.div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-3">
        {loading && <ListSkeleton />}
        {!loading && filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className="glass-card-hover">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{p.nome}</p>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={p.status === 'ativo' ? 'default' : 'secondary'} className="text-[10px]">{p.status}</Badge>
                          {getCoordCursos(p.id).length > 0 && (
                            <Badge className="text-[10px] bg-primary/20 text-primary border-primary/40">
                              COORD: {getCoordCursos(p.id).map(c => c.toUpperCase()).join(', ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {p.cpf && <p className="text-xs text-muted-foreground ml-10">CPF: {p.cpf}</p>}
                    {p.email && <p className="text-xs text-muted-foreground ml-10">{p.email}</p>}
                    <p className="text-sm text-primary font-bold ml-10">R$ {Number(p.valor_hora_aula).toFixed(2)}/h</p>
                    {getMateriaIds(p.id).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 ml-10">
                        {getMateriaIds(p.id).map(mid => {
                          const m = materias.find(x => x.id === mid);
                          return m ? <Badge key={mid} variant="outline" className="text-[10px]">{m.nome}</Badge> : null;
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit size={14} /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(p.id)}><Trash2 size={14} className="text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {!loading && filtered.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum professor encontrado</p>}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Professor' : 'Novo Professor'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} /></div>
            </div>
            <div><Label>E-mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor H/A (R$)</Label><Input value={form.valorHoraAula} onChange={e => setForm(f => ({ ...f, valorHoraAula: e.target.value }))} type="number" step="0.01" /></div>
              <div>
                <Label>PIN (4-6 dígitos)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={form.pin}
                  onChange={e => setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
                  maxLength={6}
                  placeholder={editing ? 'Deixe em branco para manter' : '1234'}
                />
              </div>
            </div>
            <div><Label>Chave PIX</Label><Input value={form.chavePix} onChange={e => setForm(f => ({ ...f, chavePix: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Agência BB</Label><Input value={form.agenciaBB} onChange={e => setForm(f => ({ ...f, agenciaBB: e.target.value }))} placeholder="0000-0" /></div>
              <div><Label>Conta BB</Label><Input value={form.contaBB} onChange={e => setForm(f => ({ ...f, contaBB: e.target.value }))} placeholder="00000-0" /></div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Matérias Vinculadas</Label>
              {materias.length === 0 ? (
                <p className="text-xs text-muted-foreground">Cadastre matérias primeiro</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-40 overflow-y-auto">
                  {materias.map(m => (
                    <Badge key={m.id} variant={form.materiaIds.includes(m.id) ? 'default' : 'outline'} className="cursor-pointer text-xs transition-all" onClick={() => toggleMateria(m.id)}>
                      {m.nome}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.coordenador}
                  onChange={e => setForm(f => ({ ...f, coordenador: e.target.checked, coordCursos: e.target.checked ? f.coordCursos : [] }))}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">Acesso de Coordenador</span>
              </label>
              {form.coordenador && (
                <>
                  <p className="text-[11px] text-muted-foreground">Selecione os cursos que este coordenador irá gerenciar:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CURSOS_DISPONIVEIS.map(c => (
                      <Badge
                        key={c.id}
                        variant={form.coordCursos.includes(c.id) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => setForm(f => ({
                          ...f,
                          coordCursos: f.coordCursos.includes(c.id)
                            ? f.coordCursos.filter(x => x !== c.id)
                            : [...f.coordCursos, c.id],
                        }))}
                      >
                        {c.nome}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Login pela tela /coordenador/login usando o nome completo + PIN.</p>
                </>
              )}
            </div>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button onClick={handleSave} className="w-full">{editing ? 'Atualizar' : 'Cadastrar'}</Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
