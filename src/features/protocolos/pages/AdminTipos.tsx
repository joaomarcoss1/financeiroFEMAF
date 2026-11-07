import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { academicoDb } from '../api/db';
import { useCategoriasAC, useTipos, type CategoriaAC } from '../api/protocolos';
import { Carregando, Erro } from '../components/Estados';
import type { TipoProtocolo } from '../lib/types';

/** Ajustes dos tipos (textos, prazos, ativo) e das categorias de AC. Etapas e campos ficam na migration. */
export default function AdminTipos() {
  const { data: tipos, isLoading, error } = useTipos(true);
  const { data: categorias = [] } = useCategoriasAC();
  if (isLoading) return <Carregando />;
  if (error) return <Erro erro={error} />;
  return (
    <div className="space-y-4">
      {(tipos ?? []).map((t) => <TipoCard key={t.id} tipo={t} />)}
      <Card className="glass-card rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="text-base">Categorias de atividades complementares</CardTitle></CardHeader>
        <CardContent className="space-y-2">{categorias.map((c) => <CategoriaLinha key={c.id} cat={c} />)}</CardContent>
      </Card>
    </div>
  );
}

function TipoCard({ tipo }: { tipo: TipoProtocolo }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({
    ativo: tipo.ativo, descricao: tipo.descricao, instrucoes_aluno: tipo.instrucoes_aluno,
    prazo_resposta_dias_uteis: tipo.prazo_resposta_dias_uteis, dias_regimentais: tipo.prazo_regimental?.dias_uteis ?? 0,
  });
  async function salvar() {
    const { dias_regimentais, ...resto } = f;
    const { error } = await academicoDb.from('protocolo_tipos').update({
      ...resto,
      prazo_regimental: tipo.prazo_regimental ? { ...tipo.prazo_regimental, dias_uteis: dias_regimentais } : null,
    }).eq('id', tipo.id);
    if (error) return toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' });
    toast({ title: 'Tipo atualizado' });
    void qc.invalidateQueries({ queryKey: ['protocolo_tipos'] });
  }
  return (
    <Card className="glass-card rounded-2xl">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{tipo.nome}</CardTitle>
        <label className="flex items-center gap-2 text-sm">Ativo <Switch checked={f.ativo} onCheckedChange={(v) => setF({ ...f, ativo: v })} /></label>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1"><Label>Descrição</Label><Input className="input-premium h-11" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
        <div className="space-y-1"><Label>Instruções ao aluno</Label><Textarea rows={2} value={f.instrucoes_aluno} onChange={(e) => setF({ ...f, instrucoes_aluno: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Prazo de análise/resposta (dias úteis)</Label><Input className="input-premium h-11" type="number" min={1} value={f.prazo_resposta_dias_uteis} onChange={(e) => setF({ ...f, prazo_resposta_dias_uteis: Number(e.target.value) })} /></div>
          {tipo.prazo_regimental && (
            <div className="space-y-1"><Label>Prazo regimental (dias úteis após a data)</Label><Input className="input-premium h-11" type="number" min={0} value={f.dias_regimentais} onChange={(e) => setF({ ...f, dias_regimentais: Number(e.target.value) })} /></div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Etapas: {tipo.etapas.map((e) => e.nome ?? e.setor).join(' → ')}</p>
        <Button size="sm" onClick={salvar}>Salvar</Button>
      </CardContent>
    </Card>
  );
}

function CategoriaLinha({ cat }: { cat: CategoriaAC }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [limite, setLimite] = useState(cat.limite_horas);
  const [ativo, setAtivo] = useState(cat.ativo);
  async function salvar(patch: Partial<CategoriaAC>) {
    const { error } = await academicoDb.from('ac_categorias').update(patch).eq('id', cat.id);
    if (error) toast({ title: 'Não foi possível salvar', description: error.message, variant: 'destructive' });
    else void qc.invalidateQueries({ queryKey: ['ac_categorias'] });
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="flex-1 min-w-[12rem]">{cat.nome}</span>
      <Input type="number" min={0} className="w-24" aria-label="Limite de horas" value={limite} onChange={(e) => setLimite(Number(e.target.value))} onBlur={() => limite !== cat.limite_horas && salvar({ limite_horas: limite })} />
      <span className="text-xs text-muted-foreground">h</span>
      <Switch checked={ativo} onCheckedChange={(v) => { setAtivo(v); void salvar({ ativo: v }); }} aria-label="Ativa" />
    </div>
  );
}
