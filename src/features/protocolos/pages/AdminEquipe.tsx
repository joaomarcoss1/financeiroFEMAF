import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from '@/hooks/useAppSettings';
import { supabase } from '@/integrations/supabase/client';
import { academicoDb, rpc } from '../api/db';
import { useSetores } from '../api/protocolos';
import { Carregando, Erro, Vazio } from '../components/Estados';

interface Membro {
  user_id: string; email: string; nome: string; created_at: string; roles: string[];
  setores: { id: string; setor_id: string; curso_id: string | null }[]; professor_id: string | null;
}
const PAPEIS = [
  { id: 'secretaria', nome: 'Secretaria' }, { id: 'coordenador', nome: 'Coordenador' },
  { id: 'diretor', nome: 'Direção' }, { id: 'setor', nome: 'Setor' }, { id: 'admin', nome: 'Administrador' },
];
const TODOS = '__todos';
const NENHUM = '__nenhum';

/** Aprovação da equipe: papéis (user_roles), setores (setor_membros) e vínculo com professor. */
export default function AdminEquipe() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { cursos } = useAppSettings();
  const { data: setores = [] } = useSetores();
  const membros = useQuery({ queryKey: ['equipe_usuarios'], queryFn: () => rpc<Membro[]>('equipe_usuarios') });
  const professores = useQuery({
    queryKey: ['professores_ativos_admin'],
    queryFn: async () => (await supabase.from('professores').select('id, nome').order('nome')).data ?? [],
  });
  const [novo, setNovo] = useState<Record<string, { setor: string; curso: string }>>({});
  const recarregar = () => { void qc.invalidateQueries({ queryKey: ['equipe_usuarios'] }); void qc.invalidateQueries({ queryKey: ['setores_sem_responsavel'] }); };
  const falhou = (e: { message: string } | null) => { if (e) toast({ title: 'Não foi possível salvar', description: e.message, variant: 'destructive' }); else recarregar(); };

  async function alternarPapel(m: Membro, papel: string, ligar: boolean) {
    const { error } = ligar
      ? await academicoDb.from('user_roles').insert({ user_id: m.user_id, role: papel })
      : await academicoDb.from('user_roles').delete().eq('user_id', m.user_id).eq('role', papel);
    falhou(error);
  }
  async function addSetor(m: Membro) {
    const n = novo[m.user_id];
    if (!n?.setor) return;
    const { error } = await academicoDb.from('setor_membros').insert({ user_id: m.user_id, setor_id: n.setor, curso_id: n.curso && n.curso !== TODOS ? n.curso : null });
    falhou(error);
  }
  async function vincularProfessor(m: Membro, professorId: string) {
    if (m.professor_id) {
      const { error } = await supabase.from('professores').update({ user_id: null } as never).eq('id', m.professor_id);
      if (error) return falhou(error);
    }
    if (professorId === NENHUM) return recarregar();
    const { error } = await supabase.from('professores').update({ user_id: m.user_id } as never).eq('id', professorId);
    falhou(error);
  }

  if (membros.isLoading) return <Carregando />;
  if (membros.error) return <Erro erro={membros.error} />;
  if (!membros.data?.length) return <><SetoresSemResponsavel /><Vazio texto="Nenhuma conta de equipe. Peça para a pessoa se cadastrar em /central/equipe/cadastro." /></>;

  return (
    <div className="space-y-3">
      <SetoresSemResponsavel />
      <p className="text-sm text-muted-foreground">
        Coordenadores: marque o papel, inclua o setor Coordenação do curso <em>ou</em> vincule ao professor que já está em Coordenadores (usa os cursos de lá).
      </p>
      {membros.data.map((m) => {
        const pendente = m.roles.length === 0 && m.setores.length === 0;
        return (
          <Card key={m.user_id} className={pendente ? 'border-amber-400' : ''}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.nome || m.email}</p>
                  <p className="text-xs text-muted-foreground break-all">{m.email} · desde {new Date(m.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                {pendente && <Badge variant="outline" className="border-amber-400">aguardando aprovação</Badge>}
              </div>
              <div className="flex flex-wrap gap-3">
                {PAPEIS.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={m.roles.includes(p.id)} onCheckedChange={(v) => alternarPapel(m, p.id, !!v)} /> {p.nome}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {m.setores.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1">
                    {setores.find((x) => x.id === s.setor_id)?.nome ?? s.setor_id}{s.curso_id ? ` · ${cursos.find((c) => c.id === s.curso_id)?.nome ?? s.curso_id}` : ''}
                    <button aria-label="Remover setor" onClick={async () => falhou((await academicoDb.from('setor_membros').delete().eq('id', s.id)).error)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={novo[m.user_id]?.setor ?? ''} onValueChange={(v) => setNovo({ ...novo, [m.user_id]: { curso: TODOS, ...novo[m.user_id], setor: v } })}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Setor" /></SelectTrigger>
                  <SelectContent>{setores.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={novo[m.user_id]?.curso ?? TODOS} onValueChange={(v) => setNovo({ ...novo, [m.user_id]: { setor: '', ...novo[m.user_id], curso: v } })}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Curso" /></SelectTrigger>
                  <SelectContent><SelectItem value={TODOS}>Todos os cursos</SelectItem>{cursos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => addSetor(m)} disabled={!novo[m.user_id]?.setor}><Plus className="h-4 w-4" /> Setor</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Professor vinculado:</span>
                <Select value={m.professor_id ?? NENHUM} onValueChange={(v) => vincularProfessor(m, v)}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUM}>Nenhum</SelectItem>
                    {(professores.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface SemResponsavel { setor_id: string; setor_nome: string; curso_id: string | null; curso_nome: string | null; protocolos_parados: number }

/**
 * Setores (e cursos) sem ninguém para tramitar. Enquanto houver, os protocolos dessas etapas só
 * podem ser movidos pelo admin, que também passa a receber os avisos no lugar do setor.
 */
function SetoresSemResponsavel() {
  const { data } = useQuery({ queryKey: ['setores_sem_responsavel'], queryFn: () => rpc<SemResponsavel[]>('setores_sem_responsavel'), refetchInterval: 60_000 });
  if (!data?.length) return null;
  const parados = data.reduce((t, s) => t + Number(s.protocolos_parados), 0);
  return (
    <div role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> {data.length} setor(es) sem responsável{parados > 0 ? ` · ${parados} protocolo(s) parado(s)` : ''}</p>
      <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
        Ninguém recebe nem tramita os pedidos destas etapas; os avisos vão para a administração. Atribua o setor a uma conta abaixo
        (coordenação: setor + curso, ou vincule o professor que já está em Coordenadores).
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {data.map((s) => (
          <li key={`${s.setor_id}-${s.curso_id ?? ''}`} className="rounded-sm border border-amber-300 bg-background/70 px-2 py-0.5 text-xs">
            {s.setor_nome}{s.curso_nome ? ` · ${s.curso_nome}` : ''}{Number(s.protocolos_parados) > 0 ? ` (${s.protocolos_parados})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
