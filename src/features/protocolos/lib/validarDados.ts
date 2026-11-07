import type { AnexoEnviado, CampoDef, ItemAC, TipoProtocolo } from './types';

export const valorVazio = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/** Mesmas regras de public.protocolo_abrir; devolve mensagens em português (vazio = ok). */
export function validarDados(tipo: Pick<TipoProtocolo, 'id' | 'campos' | 'anexos'>, dados: Record<string, unknown>, anexos: AnexoEnviado[]): string[] {
  const erros: string[] = [];
  for (const c of tipo.campos) {
    if (c.obrigatorio && valorVazio(dados[c.id])) erros.push(`Campo obrigatório: ${c.rotulo}`);
  }
  if (tipo.id === 'abono_faltas' && dados.data_inicio && dados.data_fim && String(dados.data_fim) < String(dados.data_inicio)) {
    erros.push('A data final deve ser igual ou posterior à inicial');
  }
  if (tipo.id === 'atividades_complementares') {
    const itens = (dados.itens as ItemAC[] | undefined) ?? [];
    itens.forEach((it, i) => {
      if (valorVazio(it.descricao) || !(Number(it.horas_declaradas) > 0) || valorVazio(it.anexo_path)) {
        erros.push(`Atividade ${i + 1}: informe descrição, carga horária e certificado`);
      }
    });
  }
  for (const a of tipo.anexos) {
    const n = anexos.filter((x) => x.tipo_anexo === a.id).length;
    if (a.obrigatorio && n === 0) erros.push(`Anexo obrigatório: ${a.rotulo}`);
    if (!a.multiplo && n > 1) erros.push(`Envie apenas um arquivo em: ${a.rotulo}`);
  }
  return erros;
}

/** Valida tipo e tamanho de um arquivo contra a definição do anexo. */
export function validarArquivo(def: { rotulo: string; mimes: string[]; max_mb?: number }, file: { type: string; size: number; name: string }): string | null {
  if (!def.mimes.includes(file.type)) return `Formato não aceito em ${def.rotulo}: ${file.name}`;
  if (file.size > (def.max_mb ?? 10) * 1024 * 1024) return `Arquivo acima de ${def.max_mb ?? 10} MB: ${file.name}`;
  return null;
}

/** Campos da ação obrigatórios ainda vazios. */
export function camposAcaoFaltando(campos: CampoDef[] | undefined, acao: string, dados: Record<string, unknown>): string[] {
  return (campos ?? []).filter((c) => c.acao === acao && c.obrigatorio && valorVazio(dados[c.id])).map((c) => c.rotulo);
}
