// Limites de horas por categoria (mesma regra de public.protocolo_tramitar).
export interface CategoriaAC { id: string; nome: string; limite_horas: number }
export interface AvaliacaoItem { indice: number; autentico: boolean; categoria_id?: string; horas_deferidas: number }

/** Horas ainda disponíveis em cada categoria, dado o que o aluno já tem lançado. */
export function saldoPorCategoria(categorias: CategoriaAC[], usadas: Record<string, number>): Record<string, number> {
  return Object.fromEntries(categorias.map((c) => [c.id, Math.max(0, c.limite_horas - (usadas[c.id] ?? 0))]));
}

/** Erros da avaliação: horas acima das declaradas ou do limite da categoria (somando os itens). */
export function validarAvaliacao(
  itens: { descricao: string; horas_declaradas: number }[],
  avaliacao: AvaliacaoItem[],
  categorias: CategoriaAC[],
  usadas: Record<string, number>,
): string[] {
  const erros: string[] = [];
  const saldo = saldoPorCategoria(categorias, usadas);
  for (const a of avaliacao) {
    const item = itens[a.indice];
    if (!item) { erros.push('Atividade inexistente'); continue; }
    if (!a.autentico || a.horas_deferidas <= 0) continue;
    if (a.horas_deferidas > item.horas_declaradas) erros.push(`Horas deferidas acima das declaradas em "${item.descricao}"`);
    const cat = categorias.find((c) => c.id === a.categoria_id);
    if (!cat) { erros.push(`Escolha a categoria de "${item.descricao}"`); continue; }
    if (a.horas_deferidas > saldo[cat.id]) erros.push(`Limite da categoria "${cat.nome}" excedido: restam ${saldo[cat.id]} h`);
    saldo[cat.id] -= a.horas_deferidas;
  }
  return erros;
}

export const totalDeferido = (avaliacao: AvaliacaoItem[]) =>
  avaliacao.reduce((s, a) => s + (a.autentico && a.horas_deferidas > 0 ? a.horas_deferidas : 0), 0);
