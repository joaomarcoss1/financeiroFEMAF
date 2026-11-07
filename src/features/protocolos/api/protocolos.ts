import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { academicoDb, rpc } from './db';
import type { AnexoEnviado, ProtocoloDetalhe, ProtocoloFilaRow, TipoProtocolo, StatusProtocolo } from '../lib/types';
import type { DiaCalendario } from '../lib/prazos';

export interface MeuProtocolo {
  id: string;
  numero: string;
  tipo_id: string;
  status: StatusProtocolo;
  etapa_atual: number;
  setor_atual: string | null;
  fora_do_prazo: boolean;
  prazo_resposta_em: string | null;
  aberto_em: string;
  protocolo_tipos: { nome: string } | null;
}

export interface DisciplinaAluno { materia_id: string; nome: string; professor_id: string | null; professor_nome: string | null; dias_semana: number[] }
export interface Setor { id: string; nome: string; ativo: boolean }
export interface CategoriaAC { id: string; nome: string; limite_horas: number; ativo: boolean }

async function select<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

export const useTipos = (todos = false) =>
  useQuery({
    queryKey: ['protocolo_tipos', todos],
    queryFn: () => {
      let q = academicoDb.from('protocolo_tipos').select('*').order('ordem');
      if (!todos) q = q.eq('ativo', true);
      return select<TipoProtocolo[]>(q);
    },
  });

export const useMeusProtocolos = () =>
  useQuery({
    queryKey: ['meus_protocolos'],
    queryFn: () =>
      select<MeuProtocolo[]>(
        academicoDb.from('protocolos')
          .select('id, numero, tipo_id, status, etapa_atual, setor_atual, fora_do_prazo, prazo_resposta_em, aberto_em, protocolo_tipos(nome)')
          .order('aberto_em', { ascending: false }),
      ),
  });

export const useProtocoloDetalhe = (id: string | undefined) =>
  useQuery({
    queryKey: ['protocolo', id],
    enabled: !!id,
    queryFn: () => rpc<ProtocoloDetalhe>('protocolo_detalhe', { p_id: id }),
  });

export const useFila = (filtros: { tipo_id?: string; curso_id?: string } = {}) =>
  useQuery({
    queryKey: ['fila', filtros],
    queryFn: () => rpc<ProtocoloFilaRow[]>('protocolos_fila', { p_filtros: filtros }),
    refetchInterval: 60_000,
  });

export const useDisciplinasAluno = (enabled: boolean) =>
  useQuery({ queryKey: ['aluno_disciplinas'], enabled, queryFn: () => rpc<DisciplinaAluno[]>('aluno_disciplinas') });

export const useProfessoresNomes = (enabled: boolean) =>
  useQuery({ queryKey: ['professores_nomes'], enabled, queryFn: () => rpc<{ id: string; nome: string }[]>('professores_nomes') });

export const useSetores = () =>
  useQuery({ queryKey: ['setores'], queryFn: () => select<Setor[]>(academicoDb.from('setores').select('*').order('nome')) });

export const useCategoriasAC = () =>
  useQuery({ queryKey: ['ac_categorias'], queryFn: () => select<CategoriaAC[]>(academicoDb.from('ac_categorias').select('*').order('nome')) });

/** Horas já deferidas por categoria (para o saldo na avaliação de AC). */
export const useHorasAluno = (alunoId: string | undefined) =>
  useQuery({
    queryKey: ['horas_ac', alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const rows = await select<{ categoria_id: string; horas_deferidas: number }[]>(
        academicoDb.from('aluno_horas_complementares').select('categoria_id, horas_deferidas').eq('aluno_id', alunoId),
      );
      return rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.categoria_id]: (acc[r.categoria_id] ?? 0) + Number(r.horas_deferidas) }), {});
    },
  });

/** Calendário acadêmico (feriados/sábados letivos) para o aviso de prazo; vazio se não puder ler. */
export const useCalendario = () =>
  useQuery({
    queryKey: ['calendario_academico'],
    queryFn: async () => {
      const { data } = await academicoDb.from('calendario_academico').select('data, tipo');
      return (data ?? []) as DiaCalendario[];
    },
    staleTime: 3600_000,
  });

function useInvalidar() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['protocolo'] });
    void qc.invalidateQueries({ queryKey: ['meus_protocolos'] });
    void qc.invalidateQueries({ queryKey: ['fila'] });
    void qc.invalidateQueries({ queryKey: ['documentos'] });
    void qc.invalidateQueries({ queryKey: ['para_assinar'] });
  };
}

export function useAbrirProtocolo() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: (v: { id: string; tipo: string; dados: Record<string, unknown>; anexos: AnexoEnviado[] }) =>
      rpc<{ id: string; numero: string; fora_do_prazo: boolean }>('protocolo_abrir', { p_id: v.id, p_tipo: v.tipo, p_dados: v.dados, p_anexos: v.anexos }),
    onSuccess: inv,
  });
}

export function useResponderPendencia() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: (v: { id: string; texto: string; anexos: AnexoEnviado[] }) =>
      rpc('protocolo_responder_pendencia', { p_id: v.id, p_texto: v.texto, p_anexos: v.anexos }),
    onSuccess: inv,
  });
}

export function useCancelarProtocolo() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: (v: { id: string; motivo: string }) => rpc('protocolo_cancelar', { p_id: v.id, p_motivo: v.motivo }),
    onSuccess: inv,
  });
}

export function useTramitar() {
  const inv = useInvalidar();
  return useMutation({
    mutationFn: (v: { id: string; acao: string; parecer?: string; dados?: Record<string, unknown>; setorDestino?: string }) =>
      rpc<{ status: string }>('protocolo_tramitar', {
        p_id: v.id, p_acao: v.acao, p_parecer: v.parecer ?? null, p_dados: v.dados ?? {}, p_setor_destino: v.setorDestino ?? null,
      }),
    onSuccess: inv,
  });
}
