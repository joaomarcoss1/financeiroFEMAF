import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Upload, Trash2, Loader2, CheckCircle2, X, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { legacyExamClient } from '@/lib/legacyExamClient';
import { toast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import ListSkeleton from '@/components/ListSkeleton';
import { parseRosterFile, type AlunoImportado } from '@/lib/rosterImport';
import type { Turma } from '@/lib/types';

interface AlunoRow { id: string; nome: string; matricula: string | null; ativo: boolean }

export default function AlunosTab() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [alunos, setAlunos] = useState<AlunoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<AlunoImportado[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase.from('turmas').select('*').order('nome').then(({ data }) => setTurmas((data || []) as any));
  }, []);

  useEffect(() => { if (turmaId) loadAlunos(); else setAlunos([]); }, [turmaId]);

  async function loadAlunos() {
    setLoading(true);
    const { data } = await legacyExamClient.from('turma_alunos').select('id, nome, matricula, ativo').eq('turma_id', turmaId).order('nome');
    setAlunos((data || []) as any);
    setLoading(false);
  }

  async function handleFile(f: File | null) {
    if (!f || !turmaId) return;
    setParsing(true);
    try {
      const rows = await parseRosterFile(f);
      if (rows.length === 0) {
        toast({ title: 'Nenhum aluno reconhecido', description: 'Verifique o arquivo e tente novamente.', variant: 'destructive' });
        return;
      }
      setPreview(rows);
      setSelected(new Set(rows.map((_, i) => i)));
    } catch (e: any) {
      toast({ title: 'Erro ao ler arquivo', description: e.message, variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  }

  function toggleRow(i: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  }

  function updateRow(i: number, patch: Partial<AlunoImportado>) {
    setPreview((p) => p ? p.map((r, idx) => idx === i ? { ...r, ...patch } : r) : p);
  }

  async function confirmImport() {
    if (!preview) return;
    const jaExistentes = new Set(alunos.filter((a) => a.matricula).map((a) => a.matricula));
    const rows = preview
      .filter((_, i) => selected.has(i))
      .filter((r) => r.nome.trim())
      .filter((r) => !r.matricula || !jaExistentes.has(r.matricula));

    if (rows.length === 0) {
      toast({ title: 'Nada para importar', description: 'Todos os alunos selecionados já existem na turma.', variant: 'destructive' });
      return;
    }
    setImporting(true);
    const { error } = await legacyExamClient.from('turma_alunos').insert(
      rows.map((r) => ({ turma_id: turmaId, nome: r.nome.trim(), matricula: r.matricula.trim() || null }))
    );
    setImporting(false);
    if (error) { toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `${rows.length} aluno(s) importado(s)!` });
    setPreview(null);
    loadAlunos();
  }

  async function toggleAtivo(a: AlunoRow) {
    await legacyExamClient.from('turma_alunos').update({ ativo: !a.ativo }).eq('id', a.id);
    setAlunos((prev) => prev.map((x) => x.id === a.id ? { ...x, ativo: !x.ativo } : x));
  }

  async function removerAluno(id: string) {
    if (!(await confirm('Remover este aluno da turma?', { danger: true, confirmLabel: 'Remover' }))) return;
    await legacyExamClient.from('turma_alunos').delete().eq('id', id);
    setAlunos((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="premium-card">
        <CardContent className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Turma</label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a turma" /></SelectTrigger>
              <SelectContent>{turmas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {turmaId && (
            <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${parsing ? 'opacity-60 pointer-events-none' : 'border-border hover:border-primary/40 hover:bg-primary/5'}`}>
              <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
              {parsing ? <Loader2 size={20} className="animate-spin text-primary" /> : <Upload size={20} className="text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">Envie a lista de alunos (Excel, CSV ou PDF) — nome e matrícula</span>
            </label>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="premium-card border-primary/30">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><FileSpreadsheet size={15} className="text-primary" /> Prévia da importação ({selected.size} selecionado(s))</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreview(null)}><X size={14} /></Button>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {preview.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs rounded-lg bg-muted/40 px-2 py-1.5">
                      <Checkbox checked={selected.has(i)} onCheckedChange={() => toggleRow(i)} />
                      <Input value={r.nome} onChange={(e) => updateRow(i, { nome: e.target.value })} className="h-7 text-xs flex-1" />
                      <Input value={r.matricula} onChange={(e) => updateRow(i, { matricula: e.target.value })} className="h-7 text-xs w-32" placeholder="Matrícula" />
                    </div>
                  ))}
                </div>
                <Button onClick={confirmImport} disabled={importing} className="btn-premium w-full gap-2">
                  {importing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Confirmar importação
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {turmaId && (
        loading ? <ListSkeleton /> : (
          <Card className="premium-card">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-primary" />
                <p className="text-sm font-semibold">{alunos.length} aluno(s) na turma</p>
              </div>
              {alunos.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhum aluno cadastrado. Envie a lista acima.</p>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-1">
                  {alunos.map((a) => (
                    <div key={a.id} className={`flex items-center justify-between gap-2 text-xs rounded-lg px-2.5 py-1.5 ${a.ativo ? 'bg-muted/40' : 'bg-muted/10 opacity-50'}`}>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.nome}</p>
                        {a.matricula && <p className="text-muted-foreground">Mat. {a.matricula}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={a.ativo} onCheckedChange={() => toggleAtivo(a)} className="scale-75" />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removerAluno(a.id)}><Trash2 size={12} className="text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}
      {ConfirmDialog}
    </motion.div>
  );
}
