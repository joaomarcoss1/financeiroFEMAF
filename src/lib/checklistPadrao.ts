// Checklist padrão do modelo FEMAF, espelhado do motor de validação usado
// pelas Edge Functions (supabase/functions/_shared/checklist.ts). Os dois
// arquivos existem em runtimes separados (Vite/browser vs. Deno das Edge
// Functions, que não compartilham bundler) — mantidos em sincronia manual.
export type ChecklistRuleType = 'contains_all' | 'contains_any' | 'regex_min' | 'soma_pontos';

export interface ChecklistRule {
  id: string;
  label: string;
  tipo: ChecklistRuleType;
  valores?: string[];
  regex?: string;
  minimo?: number;
  total_esperado?: number;
  tolerancia?: number;
}

// Calibrado em cima do modelo oficial (modelo oficial de prova da FEMAF) e
// confirmado contra uma prova real aprovada em produção (mesmo cabeçalho,
// mesmas instruções fixas) — não é um checklist genérico, reflete o texto
// exato que a FEMAF usa.
export const CHECKLIST_PADRAO_FEMAF: ChecklistRule[] = [
  { id: 'cabecalho_institucional', label: 'Cabeçalho institucional FEMAF', tipo: 'contains_all', valores: ['FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO', 'FEMAF'] },
  { id: 'campos_identificacao', label: 'Campos de identificação (Curso, Disciplina, Período, Data, Avaliação, Professor)', tipo: 'contains_all', valores: ['Curso:', 'Disciplina:', 'Período:', 'Data:', 'Avaliação:', 'Professor:'] },
  { id: 'campo_aluno', label: 'Campo de identificação do(a) aluno(a)', tipo: 'contains_any', valores: ['Aluno(a) / Assinatura:', 'Aluno(a)/Assinatura:', 'Aluno(a)', 'Aluno (a)', 'Aluno:'] },
  { id: 'campo_nota', label: 'Campo de nota (preenchido pela coordenação)', tipo: 'contains_any', valores: ['Nota:'] },
  {
    id: 'bloco_instrucoes',
    label: 'Bloco de instruções fixas da prova',
    tipo: 'contains_all',
    valores: [
      'INSTRUÇÕES',
      'A prova só terá validade se for respondida de caneta azul ou preta',
      'A avaliação é INDIVIDUAL',
      'Não será permitido uso de celular',
      'Essa avaliação vale 10,0',
    ],
  },
  { id: 'questoes_numeradas', label: 'Questões no padrão "Nª Questão (X,X ponto)"', tipo: 'regex_min', regex: '\\d{1,2}ª\\s*Quest[aã]o\\s*\\(', minimo: 1 },
  { id: 'pontuacao_total', label: 'Soma das pontuações das questões igual a 10,0', tipo: 'soma_pontos', regex: '\\((\\d+[,.]\\d+)\\s*ponto', total_esperado: 10, tolerancia: 0.05 },
];

export type CampoModo = 'inline' | 'center-below' | 'left-below';

export interface CampoConfig {
  /** Rótulos tentados em ordem — o primeiro encontrado na prova é usado. */
  anchors: string[];
  modo: CampoModo;
  /** Largura máxima do valor (pt) antes de truncar — limita o valor à largura da própria célula, sem invadir a célula vizinha. */
  maxWidth?: number;
}

// Campos que o prova-gerar sobrepõe em cada cópia gerada — SÓ os que ficam
// em branco no modelo original (o professor não preenche nada neles antes
// de enviar): o nome do aluno e, quando o modelo tiver um rótulo próprio
// para isso, a matrícula. Curso/Disciplina/Período/Data/Avaliação/
// Professor são sempre deixados como o professor os digitou — testado e
// confirmado que sobrepor um valor novo em cima de um texto que já existe
// no PDF produz as duas camadas de texto sobrepostas e ilegíveis (não há
// como apagar com segurança só o valor antigo sem arriscar invadir a
// célula vizinha, já que os rótulos ficam bem próximos uns dos outros
// nesse cabeçalho). A verificação de que esses campos estão corretos é
// feita pelo checklist (ver CHECKLIST_PADRAO_FEMAF acima), que bloqueia o
// envio com os erros específicos quando o cabeçalho está muito diferente.
//
// Aluno(a)/Assinatura usa 'center-below' (não 'left-below'): embora o
// .docx oficial não defina alinhamento explícito nesse parágrafo (o que
// tecnicamente equivale a alinhamento padrão/esquerda), visualmente, com
// os demais campos do cabeçalho todos centralizados, um nome alinhado à
// esquerda destoava do resto — feedback direto do usuário ao conferir um
// lote de teste real. Centralizado fica visualmente alinhado com o
// restante do cabeçalho.
export const CAMPOS_PADRAO_FEMAF: Record<string, CampoConfig> = {
  aluno: { anchors: ['Aluno(a) / Assinatura:', 'Aluno(a)/Assinatura:', 'Aluno(a)', 'Aluno (a)', 'Aluno:'], modo: 'center-below', maxWidth: 260 },
  matricula: { anchors: ['Matrícula:', 'Matrícula'], modo: 'center-below', maxWidth: 100 },
};
