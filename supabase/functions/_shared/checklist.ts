// Motor de checklist: valida o texto extraído de uma prova em PDF contra as
// regras cadastradas no modelo padrão (prova_modelos.checklist). Regras são
// avaliadas em ordem; a primeira que falhar bloqueia o envio com uma mensagem
// específica dizendo qual quesito não foi atendido.
export type ChecklistRuleType =
  | "contains_all"
  | "contains_any"
  | "regex_min"
  | "soma_pontos";

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

export interface ChecklistItemResult {
  id: string;
  label: string;
  ok: boolean;
  mensagem: string;
}

export interface ChecklistResult {
  ok: boolean;
  itens: ChecklistItemResult[];
  primeiroErro: string | null;
}

function normalize(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function runChecklist(rawText: string, regras: ChecklistRule[]): ChecklistResult {
  const text = normalize(rawText);
  const itens: ChecklistItemResult[] = [];
  let primeiroErro: string | null = null;

  for (const regra of regras) {
    let ok = true;
    let mensagem = "Conforme.";

    try {
      if (regra.tipo === "contains_all") {
        const faltando = (regra.valores || []).filter((v) => !text.includes(normalize(v)));
        ok = faltando.length === 0;
        mensagem = ok ? "Conforme." : `Não foi encontrado: "${faltando[0]}".`;
      } else if (regra.tipo === "contains_any") {
        const valores = regra.valores || [];
        ok = valores.some((v) => text.includes(normalize(v)));
        mensagem = ok ? "Conforme." : `Nenhum dos itens esperados foi encontrado (ex.: "${valores[0] ?? ""}").`;
      } else if (regra.tipo === "regex_min") {
        const re = new RegExp(regra.regex || "", "gi");
        const matches = rawText.match(re) || [];
        const minimo = regra.minimo ?? 1;
        ok = matches.length >= minimo;
        mensagem = ok ? "Conforme." : `Esperado no mínimo ${minimo} ocorrência(s) do padrão, encontrado ${matches.length}.`;
      } else if (regra.tipo === "soma_pontos") {
        const re = new RegExp(regra.regex || "\\((\\d+[,.]\\d+)\\s*ponto", "gi");
        let soma = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(rawText))) {
          soma += parseFloat(m[1].replace(",", "."));
        }
        const esperado = regra.total_esperado ?? 10;
        const tol = regra.tolerancia ?? 0.01;
        ok = Math.abs(soma - esperado) <= tol;
        mensagem = ok
          ? "Conforme."
          : `A soma das pontuações das questões é ${soma.toFixed(2)}, mas o modelo exige ${esperado.toFixed(2)}.`;
      } else {
        ok = true;
        mensagem = "Regra desconhecida — ignorada.";
      }
    } catch (e) {
      ok = false;
      mensagem = `Erro ao validar quesito: ${(e as Error).message}`;
    }

    itens.push({ id: regra.id, label: regra.label, ok, mensagem });
    if (!ok && !primeiroErro) {
      primeiroErro = `${regra.label}: ${mensagem}`;
    }
  }

  return { ok: itens.every((i) => i.ok), itens, primeiroErro };
}

// Checklist padrão calibrado a partir do modelo oficial enviado pela FEMAF
// (modelo oficial de prova da FEMAF) e confirmado contra uma prova real
// aprovada em produção — o texto das regras abaixo é o texto exato
// encontrado nos dois (cabeçalho institucional, tabela de identificação,
// instruções fixas e questões numeradas com pontuação somando 10,0). Usado
// como base inicial de qualquer novo prova_modelo — o admin pode editar
// livremente depois. Mantido em sincronia manual com
// src/lib/checklistPadrao.ts (mesma regra, runtime Deno vs. Vite/browser).
export const CHECKLIST_PADRAO_FEMAF: ChecklistRule[] = [
  {
    id: "cabecalho_institucional",
    label: "Cabeçalho institucional FEMAF",
    tipo: "contains_all",
    valores: ["FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO", "FEMAF"],
  },
  {
    id: "campos_identificacao",
    label: "Campos de identificação (Curso, Disciplina, Período, Data, Avaliação, Professor)",
    tipo: "contains_all",
    valores: ["Curso:", "Disciplina:", "Período:", "Data:", "Avaliação:", "Professor:"],
  },
  {
    id: "campo_aluno",
    label: "Campo de identificação do(a) aluno(a)",
    tipo: "contains_any",
    valores: ["Aluno(a) / Assinatura:", "Aluno(a)/Assinatura:", "Aluno(a)", "Aluno (a)", "Aluno:"],
  },
  {
    id: "campo_nota",
    label: "Campo de nota (preenchido pela coordenação)",
    tipo: "contains_any",
    valores: ["Nota:"],
  },
  {
    id: "bloco_instrucoes",
    label: "Bloco de instruções fixas da prova",
    tipo: "contains_all",
    valores: [
      "INSTRUÇÕES",
      "A prova só terá validade se for respondida de caneta azul ou preta",
      "A avaliação é INDIVIDUAL",
      "Não será permitido uso de celular",
      "Essa avaliação vale 10,0",
    ],
  },
  {
    id: "questoes_numeradas",
    label: 'Questões no padrão "Nª Questão (X,X ponto)"',
    tipo: "regex_min",
    regex: "\\d{1,2}ª\\s*Quest[aã]o\\s*\\(",
    minimo: 1,
  },
  {
    id: "pontuacao_total",
    label: "Soma das pontuações das questões igual a 10,0",
    tipo: "soma_pontos",
    regex: "\\((\\d+[,.]\\d+)\\s*ponto",
    total_esperado: 10,
    tolerancia: 0.05,
  },
];

export type CampoModo = "inline" | "center-below" | "left-below";

export interface CampoConfig {
  anchors: string[];
  modo: CampoModo;
  maxWidth?: number;
}

// Campos que o prova-gerar sobrepõe em cada cópia — SÓ os que ficam em
// branco no modelo original (nome do aluno e, quando existir, matrícula).
// Curso/Disciplina/Período/Data/Avaliação/Professor são sempre deixados
// como o professor os digitou: sobrepor um valor novo em cima de um texto
// que já existe no PDF produz as duas camadas de texto sobrepostas e
// ilegíveis — confirmado em teste automatizado local antes de este código
// ir para produção. Não há como apagar com segurança só o valor antigo
// sem arriscar invadir a célula vizinha nesse cabeçalho (rótulos muito
// próximos uns dos outros). A verificação desses campos é feita pelo
// checklist acima, que bloqueia o envio com os erros específicos.
//
// Aluno(a)/Assinatura usa "center-below": o .docx oficial não define
// alinhamento nesse parágrafo (equivale a padrão/esquerda), mas com todos
// os outros campos do cabeçalho centralizados, um nome à esquerda destoava
// visualmente — ajustado após feedback do usuário ao conferir um lote real.
export const CAMPOS_PADRAO_FEMAF: Record<string, CampoConfig> = {
  aluno: { anchors: ["Aluno(a) / Assinatura:", "Aluno(a)/Assinatura:", "Aluno(a)", "Aluno (a)", "Aluno:"], modo: "center-below", maxWidth: 260 },
  matricula: { anchors: ["Matrícula:", "Matrícula"], modo: "center-below", maxWidth: 100 },
};
