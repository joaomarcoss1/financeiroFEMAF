import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CampoDef } from '../lib/types';
import type { DisciplinaAluno } from '../api/protocolos';

export interface ContextoCampos {
  disciplinas?: DisciplinaAluno[];
  professores?: { id: string; nome: string }[];
  /** Ao escolher a disciplina, preenche o professor pela grade. */
  aoEscolherMateria?: (d: DisciplinaAluno | undefined) => void;
}

interface Props {
  campos: CampoDef[];
  valores: Record<string, unknown>;
  onChange: (id: string, valor: unknown) => void;
  contexto?: ContextoCampos;
  /** Campos tratados pelo componente pai (ex.: itens_ac). */
  ignorar?: string[];
}

export function FormularioDinamico({ campos, valores, onChange, contexto = {}, ignorar = [] }: Props) {
  return (
    <div className="space-y-4">
      {campos.filter((c) => !ignorar.includes(c.tipo) && !ignorar.includes(c.id)).map((c) => {
        const id = `campo-${c.id}`;
        const v = valores[c.id];
        const rotulo = (
          <Label htmlFor={id}>
            {c.rotulo}{c.obrigatorio && <span className="text-destructive"> *</span>}
          </Label>
        );
        let campo: React.ReactNode;
        switch (c.tipo) {
          case 'textarea':
            campo = <Textarea id={id} value={String(v ?? '')} onChange={(e) => onChange(c.id, e.target.value)} rows={4} />;
            break;
          case 'date':
            campo = <Input className="inst-field" id={id} type="date" value={String(v ?? '')} onChange={(e) => onChange(c.id, e.target.value)} />;
            break;
          case 'number':
            campo = <Input className="inst-field" id={id} type="number" inputMode="decimal" step="0.01" value={v === undefined || v === null ? '' : String(v)}
              onChange={(e) => onChange(c.id, e.target.value === '' ? null : Number(e.target.value))} />;
            break;
          case 'select':
            campo = (
              <Select value={String(v ?? '')} onValueChange={(x) => onChange(c.id, x)}>
                <SelectTrigger id={id}><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{(c.opcoes ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            );
            break;
          case 'materia':
            campo = (
              <Select value={String(v ?? '')} onValueChange={(x) => { onChange(c.id, x); contexto.aoEscolherMateria?.(contexto.disciplinas?.find((d) => d.materia_id === x)); }}>
                <SelectTrigger id={id}><SelectValue placeholder={contexto.disciplinas?.length ? 'Selecione a disciplina' : 'Nenhuma disciplina na sua turma'} /></SelectTrigger>
                <SelectContent>{(contexto.disciplinas ?? []).map((d) => <SelectItem key={d.materia_id} value={d.materia_id}>{d.nome}</SelectItem>)}</SelectContent>
              </Select>
            );
            break;
          case 'materias': {
            const sel = new Set((v as string[] | undefined) ?? []);
            campo = (
              <div className="grid gap-2 rounded-md border p-3 max-h-64 overflow-y-auto" id={id}>
                {(contexto.disciplinas ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma disciplina na sua turma.</p>}
                {(contexto.disciplinas ?? []).map((d) => (
                  <label key={d.materia_id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={sel.has(d.materia_id)} onCheckedChange={(ok) => {
                      const n = new Set(sel); if (ok) n.add(d.materia_id); else n.delete(d.materia_id); onChange(c.id, [...n]);
                    }} />
                    {d.nome}
                  </label>
                ))}
              </div>
            );
            break;
          }
          case 'professor':
            campo = (
              <Select value={String(v ?? '')} onValueChange={(x) => onChange(c.id, x)}>
                <SelectTrigger id={id}><SelectValue placeholder="Selecione o professor" /></SelectTrigger>
                <SelectContent>{(contexto.professores ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            );
            break;
          default:
            campo = <Input className="inst-field" id={id} value={String(v ?? '')} onChange={(e) => onChange(c.id, e.target.value)} />;
        }
        return (
          <div key={c.id} className="space-y-1.5">
            {rotulo}
            {campo}
            {c.ajuda && <p className="text-xs text-muted-foreground">{c.ajuda}</p>}
          </div>
        );
      })}
    </div>
  );
}
