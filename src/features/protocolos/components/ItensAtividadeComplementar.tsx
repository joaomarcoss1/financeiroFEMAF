import { useRef } from 'react';
import { Plus, Trash2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { validarArquivo } from '../lib/validarDados';
import type { AnexoDef, ItemAC } from '../lib/types';
import type { CategoriaAC } from '../api/protocolos';

export type ItemEdicao = ItemAC & { arquivo?: File };

interface Props {
  itens: ItemEdicao[];
  onChange: (itens: ItemEdicao[]) => void;
  categorias: CategoriaAC[];
  anexoDef?: AnexoDef;
}

const vazio = (): ItemEdicao => ({ descricao: '', emissor: '', cnpj: '', data: '', horas_declaradas: 0, categoria_id: '' });

/** Lista de atividades do aluno; cada uma com o seu certificado. */
export function ItensAtividadeComplementar({ itens, onChange, categorias, anexoDef }: Props) {
  const set = (i: number, patch: Partial<ItemEdicao>) => onChange(itens.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-3">
      {itens.map((it, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Atividade {i + 1}</p>
            <Button type="button" variant="ghost" size="icon" aria-label="Remover atividade" onClick={() => onChange(itens.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2"><Label>Descrição *</Label><Input value={it.descricao} onChange={(e) => set(i, { descricao: e.target.value })} /></div>
            <div className="space-y-1"><Label>Emissor</Label><Input value={it.emissor ?? ''} onChange={(e) => set(i, { emissor: e.target.value })} /></div>
            <div className="space-y-1"><Label>CNPJ do emissor</Label><Input inputMode="numeric" value={it.cnpj ?? ''} onChange={(e) => set(i, { cnpj: e.target.value })} /></div>
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={it.data ?? ''} onChange={(e) => set(i, { data: e.target.value })} /></div>
            <div className="space-y-1"><Label>Carga horária (h) *</Label>
              <Input type="number" min={0} step="0.5" inputMode="decimal" value={it.horas_declaradas || ''} onChange={(e) => set(i, { horas_declaradas: Number(e.target.value) })} />
            </div>
            <div className="space-y-1 sm:col-span-2"><Label>Categoria sugerida</Label>
              <Select value={it.categoria_id ?? ''} onValueChange={(v) => set(i, { categoria_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categorias.filter((c) => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {anexoDef && <Certificado def={anexoDef} arquivo={it.arquivo} onChange={(f) => set(i, { arquivo: f })} />}
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => onChange([...itens, vazio()])}><Plus className="h-4 w-4" /> Adicionar atividade</Button>
    </div>
  );
}

function Certificado({ def, arquivo, onChange }: { def: AnexoDef; arquivo?: File; onChange: (f?: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}><Paperclip className="h-4 w-4" /> {arquivo ? 'Trocar certificado' : 'Anexar certificado *'}</Button>
      {arquivo && <span className="text-sm truncate max-w-[14rem]">{arquivo.name}</span>}
      <input ref={ref} type="file" className="hidden" accept={def.mimes.join(',')} onChange={(e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const erro = validarArquivo(def, f);
        if (erro) toast({ title: erro, variant: 'destructive' }); else onChange(f);
        e.target.value = '';
      }} />
    </div>
  );
}

/** Exibição somente leitura dos itens enviados. */
export function ItensAtividadeLeitura({ itens, categorias }: { itens: ItemAC[]; categorias: CategoriaAC[] }) {
  return (
    <div className="space-y-2">
      {itens.map((it, i) => (
        <div key={i} className="rounded border p-2 text-sm">
          <p className="font-medium">{i + 1}. {it.descricao} — {it.horas_declaradas} h</p>
          <p className="text-xs text-muted-foreground">
            {[it.emissor, it.cnpj && `CNPJ ${it.cnpj}`, it.data && it.data.split('-').reverse().join('/'), categorias.find((c) => c.id === it.categoria_id)?.nome].filter(Boolean).join(' · ')}
          </p>
        </div>
      ))}
    </div>
  );
}
