export interface Professor {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  valor_hora_aula: number;
  chave_pix: string | null;
  status: string;
  /** Nunca trazer o hash real do PIN para o cliente — usar `tem_pin`. */
  tem_pin?: boolean;
  agencia_bb?: string | null;
  conta_bb?: string | null;
  created_at: string;
  materia_ids?: string[];
}


export interface Materia {
  id: string;
  nome: string;
  carga_horaria_total: number;
  curso_id: string;
  created_at: string;
  turno?: string | null;
  /** 'hora_aula' (padrão, paga por aula dada) ou 'fixo_semestral' (valor fixo dividido pelas quinzenas do período). */
  pagamento_tipo: string;
  valor_fixo_semestral: number;
  pagamento_inicio: string | null;
  pagamento_fim: string | null;
  horas_fixas_quinzenais?: number;
}

export interface Turma {
  id: string;
  nome: string;
  curso_id: string;
  periodo: string | null;
  turno: string | null;
  created_at: string;
}

export interface Curso {
  id: string;
  nome: string;
}

export interface RegistroPonto {
  id: string;
  professor_id: string;
  materia_id: string;
  turma_id: string;
  data: string;
  horarios: number[];
  quantidade_horarios: number;
  carga_horaria: number;
  valor_total: number;
  observacao: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Estes arrays são MUTADOS em runtime por `applySettingsToConstants()`
 * (em src/lib/appSettings.ts) assim que as configurações do banco carregam.
 * Por isso a referência do array é mantida — componentes que importam
 * { CURSOS } / { HORARIOS } recebem os valores hidratados sem precisar
 * de re-import.
 */
export const CURSOS: Curso[] = [
  { id: 'eng', nome: 'Engenharia Civil' },
  { id: 'ped', nome: 'Pedagogia' },
  { id: 'psi', nome: 'Psicologia' },
];

export const HORARIOS: { id: number; label: string; inicio: string; fim: string; turno: string }[] = [
  { id: 1, label: '1º Horário', inicio: '18:30', fim: '19:20', turno: 'noturno' },
  { id: 2, label: '2º Horário', inicio: '19:20', fim: '20:10', turno: 'noturno' },
  { id: 3, label: '3º Horário', inicio: '20:20', fim: '21:10', turno: 'noturno' },
  { id: 4, label: '4º Horário', inicio: '21:10', fim: '22:00', turno: 'noturno' },
  { id: 5, label: '1º Horário', inicio: '14:00', fim: '15:00', turno: 'vespertino' },
  { id: 6, label: '2º Horário', inicio: '15:00', fim: '16:00', turno: 'vespertino' },
  { id: 7, label: '3º Horário', inicio: '16:00', fim: '17:00', turno: 'vespertino' },
  { id: 8, label: '4º Horário', inicio: '17:00', fim: '18:00', turno: 'vespertino' },
];

export function isMateriaPratica(nome: string | undefined | null): boolean {
  if (!nome) return false;
  return /pr[áa]tica/i.test(nome);
}

export let MINUTOS_POR_HORARIO = 50;
export function _setMinutosPorHorario(v: number) { MINUTOS_POR_HORARIO = v; }
