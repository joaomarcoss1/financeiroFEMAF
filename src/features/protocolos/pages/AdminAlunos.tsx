import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from '@/hooks/useAppSettings';
import { supabase } from '@/integrations/supabase/client';
import { readSpreadsheetFile } from '@/lib/rosterImport';
import { academicoDb } from '../api/db';
import { Carregando, Erro, Vazio } from '../components/Estados';
import { cpfValido, formatarCpf, somenteDigitos } from '../lib/cpf';
import { parsePlanilhaAlunos, type LinhaAluno } from '../lib/importAlunos';

interface Aluno {
  id: string; user_id: string | null; matricula: string; nome: string; cpf: string; data_nascimento: string;
  email: string | null; telefone: string | null; curso_id: string; turma_id: string | null; situacao: string;
}
const SITUACOES = ['ativo', 'trancado', 'formado', 'cancelado'];
const NOVO: Omit<Aluno, 'id' | 'user_id'> = { matricula: '', nome: '', cpf: '', data_nascimento: '', email: '', telefone: '', curso_id: '', turma_id: null, situacao: 'ativo' };

export default function AdminAlunos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { cursos } = useAppSettings();
  const [busca, setBusca] = useState('');
  const [edit, setEdit] = useState<(Omit<Aluno, 'id' | 'user_id'> & { id?: string }) | null>(null);
  const [previa, setPrevia] = useState<LinhaAluno[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const alunos = useQuery({
    queryKey: ['admin_alunos'],
    queryFn: async () => {
      const { data, error } = await academicoDb.from('alunos').select('*').order('nome').limit(5000);
      if (error) throw new Error(error.message);
      return data as Aluno[];
    },
  });
  const turmas = useQuery({
    queryKey: ['turmas_lista'],
    queryFn: async () => (await supabase.from('turmas').select('id, nome, curso_id').order('nome')).data ?? [],
  });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (alunos.data ?? []).filter((a) => !q || a.nome.toLowerCase().includes(q) || a.matricula.toLowerCase().includes(q) || a.cpf.includes(somenteDigitos(q) || '#'));
  }, [alunos.data, busca]);
  const nomeTurma = (id: string | null) => turmas.data?.find((t) => t.id === id)?.nome;
  const nomeCurso = (id: string) => cursos.find((c) => c.id === id)?.nome ?? id;

  async function salvar() {
    if (!edit) return;
    const cpf = somenteDigitos(edit.cpf);
    if (!edit.matricula.trim() || !edit.nome.trim() || !edit.data_nascimento || !edit.curso_id) return toast({ title: 'Preencha matrícula, nome, nascimento e curso', variant: 'destructive' });
    if (!cpfValido(cpf)) return toast({ title: 'CPF inválido', variant: 'destructive' });
    setSalvando(true);
    const row = { ...edit, cpf, matricula: edit.matricula.trim(), nome: edit.nome.trim(), email: edit.email || null, telefone: edit.telefone || null, updated_at: new Date().toISOString() };
    const { id, ...dados } = row;
    const { error } = id ? await academicoDb.from('alunos').update(dados).eq('id', id) : await academicoDb.from('alunos').insert(dados);
    setSalvando(false);
    if (error) return toast({ title: 'Não foi possível salvar', description: /duplicate|unique/i.test(error.message) ? 'Matrícula ou CPF já cadastrados.' : error.message, variant: 'destructive' });
    setEdit(null);
    void qc.invalidateQueries({ queryKey: ['admin_alunos'] });
  }

  async function lerArquivo(f: File) {
    try {
      const rows = await readSpreadsheetFile(f);
      const existentes = { matriculas: new Set((alunos.data ?? []).map((a) => a.matricula.toLowerCase())), cpfs: new Set((alunos.data ?? []).map((a) => a.cpf)) };
      setPrevia(parsePlanilhaAlunos(rows, cursos, turmas.data ?? [], existentes));
    } catch (e) {
      toast({ title: 'Não foi possível ler o arquivo', description: (e as Error).message, variant: 'destructive' });
    }
  }

  async function importar() {
    const validos = (previa ?? []).filter((l) => !l.erros.length);
    setSalvando(true);
    for (let i = 0; i < validos.length; i += 200) {
      const lote = validos.slice(i, i + 200).map(({ matricula, nome, cpf, data_nascimento, email, curso_id, turma_id }) => ({ matricula, nome, cpf, data_nascimento, email, curso_id, turma_id }));
      const { error } = await academicoDb.from('alunos').insert(lote);
      if (error) {
        setSalvando(false);
        void qc.invalidateQueries({ queryKey: ['admin_alunos'] });
        return toast({ title: `Importação parou na linha ${validos[i].linha}`, description: error.message, variant: 'destructive' });
      }
    }
    setSalvando(false);
    setPrevia(null);
    toast({ title: `${validos.length} aluno(s) importado(s)` });
    void qc.invalidateQueries({ queryKey: ['admin_alunos'] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nome, matrícula ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> Importar CSV/XLSX</Button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); e.target.value = ''; }} />
        <Button onClick={() => setEdit({ ...NOVO })}><Plus className="h-4 w-4" /> Novo aluno</Button>
      </div>
      <p className="text-xs text-muted-foreground">Colunas da planilha: Matrícula, Nome, CPF, Data de nascimento, E-mail, Curso, Turma (curso e turma pelo nome ou código).</p>

      {alunos.isLoading ? <Carregando /> : alunos.error ? <Erro erro={alunos.error} /> : !lista.length ? <Vazio texto="Nenhum aluno cadastrado." /> : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{lista.length} aluno(s)</p>
          {lista.slice(0, 300).map((a) => (
            <Card key={a.id} className="cursor-pointer hover:border-primary" onClick={() => setEdit({ ...a, email: a.email ?? '', telefone: a.telefone ?? '' })}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">{a.matricula} · {nomeCurso(a.curso_id)}{nomeTurma(a.turma_id) ? ` · ${nomeTurma(a.turma_id)}` : ''}</p>
                </div>
                <div className="flex gap-1.5">
                  {a.situacao !== 'ativo' && <Badge variant="secondary">{a.situacao}</Badge>}
                  <Badge variant={a.user_id ? 'default' : 'outline'}>{a.user_id ? 'conta ativa' : 'sem conta'}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {lista.length > 300 && <p className="text-xs text-muted-foreground">Mostrando 300; refine a busca.</p>}
        </div>
      )}

      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{edit.id ? 'Editar aluno' : 'Novo aluno'}</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Matrícula *</Label><Input className="input-premium h-11" value={edit.matricula} onChange={(e) => setEdit({ ...edit, matricula: e.target.value })} /></div>
              <div className="space-y-1"><Label>CPF *</Label><Input className="input-premium h-11" inputMode="numeric" value={formatarCpf(edit.cpf)} onChange={(e) => setEdit({ ...edit, cpf: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Nome *</Label><Input className="input-premium h-11" value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></div>
              <div className="space-y-1"><Label>Nascimento *</Label><Input className="input-premium h-11" type="date" value={edit.data_nascimento} onChange={(e) => setEdit({ ...edit, data_nascimento: e.target.value })} /></div>
              <div className="space-y-1"><Label>Telefone</Label><Input className="input-premium h-11" value={edit.telefone ?? ''} onChange={(e) => setEdit({ ...edit, telefone: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>E-mail</Label><Input className="input-premium h-11" type="email" value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Curso *</Label>
                <Select value={edit.curso_id} onValueChange={(v) => setEdit({ ...edit, curso_id: v, turma_id: null })}>
                  <SelectTrigger><SelectValue placeholder="Curso" /></SelectTrigger>
                  <SelectContent>{cursos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Turma</Label>
                <Select value={edit.turma_id ?? ''} onValueChange={(v) => setEdit({ ...edit, turma_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Turma" /></SelectTrigger>
                  <SelectContent>{(turmas.data ?? []).filter((t) => t.curso_id === edit.curso_id).map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Situação</Label>
                <Select value={edit.situacao} onValueChange={(v) => setEdit({ ...edit, situacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SITUACOES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={salvar} disabled={salvando}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {previa && (
        <Dialog open onOpenChange={(o) => !o && setPrevia(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Prévia da importação</DialogTitle></DialogHeader>
            <p className="text-sm">
              {previa.filter((l) => !l.erros.length).length} válida(s) · {previa.filter((l) => l.duplicado).length} duplicada(s) ·{' '}
              {previa.filter((l) => l.erros.length && !l.duplicado).length} com erro
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-muted-foreground"><th className="p-1">Linha</th><th className="p-1">Matrícula</th><th className="p-1">Nome</th><th className="p-1">CPF</th><th className="p-1">Nasc.</th><th className="p-1">Situação</th></tr></thead>
                <tbody>
                  {previa.map((l) => (
                    <tr key={l.linha} className={l.erros.length ? 'text-destructive' : ''}>
                      <td className="p-1">{l.linha}</td><td className="p-1">{l.matricula}</td><td className="p-1">{l.nome}</td>
                      <td className="p-1 whitespace-nowrap">{formatarCpf(l.cpf)}</td><td className="p-1 whitespace-nowrap">{l.data_nascimento}</td>
                      <td className="p-1">{l.erros.join(', ') || 'ok'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setPrevia(null)}>Cancelar</Button>
              <Button onClick={importar} disabled={salvando || !previa.some((l) => !l.erros.length)}>
                {salvando ? 'Importando…' : `Importar ${previa.filter((l) => !l.erros.length).length} válido(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
