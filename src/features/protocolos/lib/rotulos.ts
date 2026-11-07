import type { StatusProtocolo } from './types';

export const STATUS_LABEL: Record<StatusProtocolo, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  aguardando_aluno: 'Aguardando aluno',
  deferido: 'Deferido',
  indeferido: 'Indeferido',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const ACAO_LABEL: Record<string, string> = {
  abertura: 'Protocolo aberto',
  deferir: 'Deferido',
  indeferir: 'Indeferido',
  solicitar_complementacao: 'Complementação solicitada',
  resposta_aluno: 'Resposta do aluno',
  encaminhar: 'Encaminhado',
  concluir: 'Concluído',
  comentar: 'Comentário',
  cancelamento: 'Cancelado pelo aluno',
};

export const ACAO_BOTAO: Record<string, string> = {
  deferir: 'Deferir',
  indeferir: 'Indeferir',
  solicitar_complementacao: 'Solicitar complementação',
  encaminhar: 'Encaminhar',
  concluir: 'Concluir',
  comentar: 'Comentar',
};

export const STATUS_FINAIS: StatusProtocolo[] = ['concluido', 'indeferido', 'deferido', 'cancelado'];

export const dataBR = (v: string | null | undefined) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '');
export const dataHoraLocal = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
