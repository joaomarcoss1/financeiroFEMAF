import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Link2, type LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirm } from '@/hooks/useConfirm';
import ListSkeleton from '@/components/ListSkeleton';

interface ItemBase { id: string; nome: string }
interface Juncao { id: string; nome: string; ativo: boolean; item_ids: string[] }

export interface JuncaoManagerProps {
  /** Tabela de junções: materia_juncoes | turma_juncoes */
  table: 'materia_juncoes' | 'turma_juncoes';
  /** Coluna que guarda o array de ids na tabela de junção. */
  idsColumn: 'materia_ids' | 'turma_ids';
  /** Tabela dos itens que compõem a junção: materias | turmas */
  itemsTable: 'materias' | 'turmas';
  titulo: string;
  descricao: string;
  icon: LucideIcon;
  /** Ex.: "disciplinas" / "turmas" — usado nos textos de ajuda. */
  itemLabelPlural: string;
  nomePlaceholder: string;
}

/**
 * Componente genérico para as telas de "Junção de Disciplinas" e "Junção de
 * Turmas" — antes duas páginas ~95% idênticas (JuncoesDisciplinas.tsx /
 * JuncoesTurmas.tsx), unificadas aqui e parametrizadas por tabela.
 */
export default function JuncaoManager({
  table, idsColumn, itemsTable, titulo, descricao, icon: Icon, itemLabelPlural, nomePlaceholder,
}: JuncaoManagerProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [juncoes, setJuncoes] = useState<Juncao[]>([]);
  const [items, setItems] = useState<ItemBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Juncao | null>(null);
  const [form, setForm] = useState({ nome: '', item_ids: [] as string[], ativo: true });

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [table]);

  async function load() {
    setLoading(true);
    const [{ data: j }, { data: i }] = await Promise.all([
      (supabase.from(table as any).select('*').order('created_at', { ascending: false }) as any),
      (supabase.from(itemsTable).select('id,nome').order('nome') as any),
    ]);
    const juncoesNormalizadas: Juncao[] = ((j || []) as any[]).map((row) => ({
      id: row.id, nome: row.nome, ativo: row.ativo, item_ids: row[idsColumn] || [],
    }));
    setJuncoes(juncoesNormalizadas);
    setItems((i || []) as ItemBase[]);
    setLoading(false);
  }

  const itemMap = useMemo(() => {
    const m = new Map<string, ItemBase>();
    items.forEach((x) => m.set(x.id, x));
    return m;
  }, [items]);

  function openNew() {
    setEditing(null);
    setForm({ nome: '', item_ids: [], ativo: true });
    setDialogOpen(true);
  }

  function openEdit(j: Juncao) {
    setEditing(j);
    setForm({ nome: j.nome, item_ids: [...j.item_ids], ativo: j.ativo });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) return toast({ title: 'Informe o nome', variant: 'destructive' });
    if (form.item_ids.length < 2) return toast({ title: `Selecione ao menos 2 ${itemLabelPlural}`, variant: 'destructive' });

    const payload = { nome: form.nome.trim(), [idsColumn]: form.item_ids, ativo: form.ativo };
    const { error } = editing
      ? await (supabase.from(table as any).update(payload).eq('id', editing.id) as any)
      : await (supabase.from(table as any).insert(payload) as any);
    if (error) return toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    toast({ title: editing ? 'Junção atualizada' : 'Junção criada' });
    setDialogOpen(false);
    load();
  }

  async function remove(j: Juncao) {
    if (!(await confirm(`Excluir a junção "${j.nome}"?`, { danger: true, confirmLabel: 'Excluir' }))) return;
    const { error } = await (supabase.from(table as any).delete().eq('id', j.id) as any);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Junção excluída' });
    load();
  }

  async function toggleAtivo(j: Juncao) {
    const { error } = await (supabase.from(table as any).update({ ativo: !j.ativo }).eq('id', j.id) as any);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    load();
  }

  function toggleItem(id: string) {
    setForm((f) => ({
      ...f,
      item_ids: f.item_ids.includes(id) ? f.item_ids.filter((x) => x !== id) : [...f.item_ids, id],
    }));
  }

  return (
    <div className="container py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="icon-badge w-11 h-11 rounded-2xl gradient-primary shrink-0">
            <Icon size={20} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">{titulo}</h1>
            <p className="text-sm text-muted-foreground">{descricao}</p>
          </div>
        </div>
        <motion.div whileTap={{ scale: 0.97 }} className="shrink-0">
          <Button onClick={openNew} className="w-full sm:w-auto btn-glow btn-premium gap-2">
            <Plus className="h-4 w-4" /> Nova Junção
          </Button>
        </motion.div>
      </motion.div>

      <div className="grid gap-3">
        {loading && <ListSkeleton rows={3} />}
        {!loading && juncoes.length === 0 && (
          <Card className="glass-card">
            <CardContent className="py-10 text-center text-muted-foreground space-y-2">
              <Link2 className="h-8 w-8 mx-auto opacity-40" />
              <p>Nenhuma junção cadastrada.</p>
            </CardContent>
          </Card>
        )}
        {!loading && juncoes.map((j, i) => (
          <motion.div key={j.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
            <Card className="glass-card-hover">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{j.nome}</h3>
                    {j.ativo
                      ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Ativa</Badge>
                      : <Badge variant="secondary">Inativa</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {j.item_ids.map((id) => (
                      <Badge key={id} variant="outline">{itemMap.get(id)?.nome || '???'}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={j.ativo} onCheckedChange={() => toggleAtivo(j)} />
                  <Button size="sm" variant="outline" onClick={() => openEdit(j)}><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(j)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <AnimatePresence mode="wait">
            <motion.div key={editing ? 'edit' : 'new'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <DialogHeader>
                <DialogTitle className="font-display">{editing ? 'Editar Junção' : 'Nova Junção'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder={nomePlaceholder} className="input-premium mt-1" />
                </div>
                <div>
                  <Label>{titulo.replace('Junção de ', '')} envolvidas</Label>
                  <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-border/60 divide-y divide-border/50">
                    {items.map((it) => (
                      <label key={it.id} className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors">
                        <Checkbox checked={form.item_ids.includes(it.id)} onCheckedChange={() => toggleItem(it.id)} />
                        <span className="text-sm">{it.nome}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Selecione ao menos 2 {itemLabelPlural}.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  <Label>Ativa</Label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <motion.div whileTap={{ scale: 0.97 }}>
                    <Button onClick={save} className="btn-premium">{editing ? 'Salvar' : 'Criar'}</Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
