// Formato dos tipos de protocolo gravados em public.protocolo_tipos (Migration C).
export type CampoTipo = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'materia' | 'materias' | 'professor' | 'itens_ac' | 'itens_ac_avaliacao';

export interface CampoDef {
  id: string;
  rotulo: string;
  tipo: CampoTipo;
  obrigatorio?: boolean;
  opcoes?: string[];
  ajuda?: string;
  acao?: string; // só em campos_acao
}

export interface AnexoDef {
  id: string;
  rotulo: string;
  obrigatorio?: boolean;
  mimes: string[];
  max_mb?: number;
  multiplo?: boolean;
  sensivel?: boolean;
}

export type AcaoTramite = 'deferir' | 'indeferir' | 'solicitar_complementacao' | 'encaminhar' | 'concluir' | 'comentar';

export interface EtapaDef {
  ordem: number;
  setor: string; // '*' = definido ao encaminhar
  nome?: string;
  acoes: AcaoTramite[];
  campos_acao?: CampoDef[];
  ao_deferir?: 'proxima' | 'encerrar';
  ao_indeferir?: 'encerrar';
  ao_concluir?: 'encerrar';
  notificar?: string[];
}

export interface TipoProtocolo {
  id: string;
  nome: string;
  descricao: string;
  instrucoes_aluno: string;
  campos: CampoDef[];
  anexos: AnexoDef[];
  etapas: EtapaDef[];
  prazo_regimental: { campo: string; dias_uteis: number } | null;
  prazo_resposta_dias_uteis: number;
  gera_documento: string | null;
  ativo: boolean;
  ordem: number;
}

export type StatusProtocolo = 'aberto' | 'em_analise' | 'aguardando_aluno' | 'deferido' | 'indeferido' | 'concluido' | 'cancelado';

export interface ItemAC {
  descricao: string;
  emissor?: string;
  cnpj?: string;
  data?: string;
  horas_declaradas: number;
  categoria_id?: string;
  anexo_path?: string;
}

/** Anexo pronto para enviar à RPC (arquivo já no bucket). */
export interface AnexoEnviado {
  tipo_anexo: string;
  nome_arquivo: string;
  storage_path: string;
  sha256?: string;
  mime?: string;
  tamanho?: number;
}

export interface ProtocoloFilaRow {
  id: string;
  numero: string;
  tipo_id: string;
  tipo_nome: string;
  aluno_nome: string;
  matricula: string;
  curso_id: string;
  status: StatusProtocolo;
  etapa_atual: number;
  setor_atual: string | null;
  fora_do_prazo: boolean;
  prazo_resposta_em: string | null;
  aberto_em: string;
  updated_at: string;
  minha_etapa: boolean;
}

export interface Tramite {
  id: string;
  etapa: number;
  setor_id: string | null;
  setor_nome: string | null;
  acao: string;
  parecer: string | null;
  dados: Record<string, unknown>;
  visivel_aluno: boolean;
  created_at: string;
  autor: string | null;
}

export interface AnexoRow {
  id: string;
  tramite_id: string | null;
  tipo_anexo: string;
  nome_arquivo: string;
  storage_path: string;
  mime: string | null;
  tamanho: number | null;
  sensivel: boolean;
  created_at: string;
}

export interface DocumentoResumo {
  id: string;
  codigo: string;
  titulo: string;
  status: 'aguardando_assinatura' | 'assinado' | 'cancelado';
  storage_path: string | null;
  emitido_em: string;
}

export interface ProtocoloDetalhe {
  protocolo: {
    id: string;
    numero: string;
    tipo_id: string;
    aluno_id: string;
    curso_id: string;
    dados: Record<string, unknown>;
    status: StatusProtocolo;
    etapa_atual: number;
    setor_atual: string | null;
    fora_do_prazo: boolean;
    prazo_resposta_em: string | null;
    aberto_em: string;
    concluido_em: string | null;
    decisao: 'deferido' | 'indeferido' | null;
    parecer_final: string | null;
  };
  tipo: TipoProtocolo;
  aluno: { id: string; nome: string; matricula: string; curso_id: string; turma: string | null; email: string | null; telefone: string | null };
  setor_nome: string | null;
  tramites: Tramite[];
  anexos: AnexoRow[];
  anexos_ocultos: number;
  documentos: DocumentoResumo[];
  eh_aluno: boolean;
  pode_atuar: boolean;
  pode_comentar: boolean;
}
