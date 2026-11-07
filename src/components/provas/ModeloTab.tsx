import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileCheck2, Plus, Edit, Trash2, RotateCcw, Upload, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { legacyExamClient } from '@/lib/legacyExamClient';
import { toast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import ListSkeleton from '@/components/ListSkeleton';
import { CHECKLIST_PADRAO_FEMAF, CAMPOS_PADRAO_FEMAF } from '@/lib/checklistPadrao';

interface ProvaModelo {
  id: string; nome: string; descricao: string | null; arquivo_url: string | null;
  ativo: boolean; checklist: unknown; campos: unknown; created_at: string;
}

export default function ModeloTab() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [modelos, setModelos] = useState<ProvaModelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProvaModelo | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [checklistJson, setChecklistJson] = useState('');
  const [camposJson, setCamposJson] = useState('');
  const [refFile, setRefFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await legacyExamClient.from('prova_modelos').select('*').order('created_at', { ascending: false });
    setModelos((data || []) as any);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setNome('Modelo padrão FEMAF');
    setDescricao('');
    setAtivo(modelos.length === 0);
    setChecklistJson(JSON.stringify(CHECKLIST_PADRAO_FEMAF, null, 2));
    setCamposJson(JSON.stringify(CAMPOS_PADRAO_FEMAF, null, 2));
    setRefFile(null);
    setDialogOpen(true);
  }

  function openEdit(m: ProvaModelo) {
    setEditing(m);
    setNome(m.nome);
    setDescricao(m.descricao || '');
    setAtivo(m.ativo);
    setChecklistJson(JSON.stringify(m.checklist ?? [], null, 2));
    setCamposJson(JSON.stringify(m.campos ?? {}, null, 2));
    setRefFile(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!nome.trim()) { toast({ title: 'Informe o nome do modelo', variant: 'destructive' }); return; }
    let checklist: unknown, campos: unknown;
    try { checklist = JSON.parse(checklistJson); } catch { toast({ title: 'JSON do checklist inválido', variant: 'destructive' }); return; }
    try { campos = JSON.parse(camposJson); } catch { toast({ title: 'JSON dos campos inválido', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      let arquivoUrl = editing?.arquivo_url || null;
      if (refFile) {
        const path = `${(editing?.id) || 'novo-' + Date.now()}/${Date.now()}-${refFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('provas-modelos').upload(path, refFile, { upsert: true });
        if (upErr) throw new Error(upErr.message);
        arquivoUrl = path;
      }

      const payload = { nome: nome.trim(), descricao: descricao.trim() || null, ativo, checklist, campos, arquivo_url: arquivoUrl };

      if (ativo) {
        // Só um modelo ativo por vez — evita ambiguidade no checklist aplicado.
        await legacyExamClient.from('prova_modelos').update({ ativo: false }).neq('id', editing?.id || '00000000-0000-0000-0000-000000000000');
      }

      if (editing) {
        const { error } = await legacyExamClient.from('prova_modelos').update(payload).eq('id', editing.id);
        if (error) throw new Error(error.message);
        toast({ title: 'Modelo atualizado!' });
      } else {
        const { error } = await legacyExamClient.from('prova_modelos').insert(payload);
        if (error) throw new Error(error.message);
        toast({ title: 'Modelo cadastrado!' });
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm('Excluir este modelo?', { danger: true, confirmLabel: 'Excluir' }))) return;
    await legacyExamClient.from('prova_modelos').delete().eq('id', id);
    toast({ title: 'Modelo removido' });
    load();
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{modelos.length} modelo(s) cadastrado(s)</p>
        <Button onClick={openNew} className="gap-2"><Plus size={16} /> Novo modelo</Button>
      </div>

      {loading ? <ListSkeleton /> : modelos.length === 0 ? (
        <Card className="premium-card"><CardContent className="p-8 text-center text-muted-foreground text-sm">
          Nenhum modelo cadastrado. Crie o modelo padrão para habilitar o envio de provas.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {modelos.map((m) => (
            <Card key={m.id} className="glass-card-hover">
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileCheck2 size={18} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{m.nome}</p>
                      {m.ativo && <Badge className="bg-success/15 text-success border-success/30">Ativo</Badge>}
                    </div>
                    {m.descricao && <p className="text-xs text-muted-foreground truncate">{m.descricao}</p>}
                    <p className="text-[11px] text-muted-foreground mt-0.5">{Array.isArray(m.checklist) ? m.checklist.length : 0} quesito(s) no checklist</p>
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}><Edit size={14} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(m.id)}><Trash2 size={14} className="text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar Modelo' : 'Novo Modelo'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" /></div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <span className="text-sm font-medium">Modelo ativo (usado na validação)</span>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>

            <div>
              <Label>Arquivo de referência (opcional)</Label>
              <label className="mt-1 flex items-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/40 p-3 cursor-pointer text-sm">
                <input type="file" className="hidden" onChange={(e) => setRefFile(e.target.files?.[0] || null)} />
                {refFile ? <><FileText size={16} className="text-primary" /> {refFile.name}</> : <><Upload size={16} className="text-muted-foreground" /> <span className="text-muted-foreground">{editing?.arquivo_url ? 'Substituir arquivo de referência' : 'Enviar arquivo de referência'}</span></>}
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Checklist (JSON)</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => setChecklistJson(JSON.stringify(CHECKLIST_PADRAO_FEMAF, null, 2))}>
                  <RotateCcw size={11} /> Restaurar padrão FEMAF
                </Button>
              </div>
              <Textarea value={checklistJson} onChange={(e) => setChecklistJson(e.target.value)} rows={10} className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground mt-1">Cada quesito bloqueia o envio e mostra sua mensagem quando não atendido.</p>
            </div>

            <div>
              <Label>Campos auto-inseridos (JSON)</Label>
              <Textarea value={camposJson} onChange={(e) => setCamposJson(e.target.value)} rows={6} className="font-mono text-xs" />
              <p className="text-[11px] text-muted-foreground mt-1">
                Só os campos que ficam em <strong>branco</strong> no modelo (nome do aluno e, se houver, matrícula) — os demais o professor já preenche no Word e o sistema não sobrescreve. Para cada campo: <code>anchors</code> (rótulos tentados em ordem no PDF enviado) e <code>modo</code> (<code>left-below</code> para rótulos alinhados à esquerda, como "Aluno(a) / Assinatura:"; <code>center-below</code> para rótulos centralizados). A conformidade do cabeçalho (Curso, Disciplina, Período, Data, Avaliação, Professor) é garantida pelo checklist acima, que bloqueia o envio com os erros específicos se estiver muito diferente do modelo.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="btn-premium w-full">{editing ? 'Atualizar' : 'Cadastrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </motion.div>
  );
}
