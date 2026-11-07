import { describe, expect, it } from 'vitest';
import { cpfValido, formatarCpf } from './cpf';
import { diasUteisApos, ehDiaUtil, foraDoPrazo } from './prazos';
import { formatarNumeroProtocolo, parseNumeroProtocolo, proximoNumero } from './numeroProtocolo';
import { validarArquivo, validarDados, camposAcaoFaltando } from './validarDados';
import { saldoPorCategoria, totalDeferido, validarAvaliacao } from './horasAC';

describe('cpf', () => {
  it('aceita CPF válido com ou sem máscara', () => {
    expect(cpfValido('123.456.789-09')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });
  it('rejeita dígito errado, repetidos e tamanho incorreto', () => {
    expect(cpfValido('123.456.789-00')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('1234567890')).toBe(false);
  });
  it('formata', () => expect(formatarCpf('12345678909')).toBe('123.456.789-09'));
});

describe('prazos (dias úteis)', () => {
  const cal = new Map([['2026-11-02', 'feriado'], ['2026-11-07', 'sabado_letivo']]);
  it('pula fim de semana e feriado', () => {
    // sex 30/10 + 3 dias úteis: seg 02/11 é feriado ⇒ 03, 04, 05
    expect(diasUteisApos('2026-10-30', 3, cal)).toBe('2026-11-05');
  });
  it('conta sábado letivo', () => {
    expect(ehDiaUtil('2026-11-07', cal)).toBe(true);
    expect(diasUteisApos('2026-11-06', 1, cal)).toBe('2026-11-07');
  });
  it('fora do prazo só depois do último dia útil', () => {
    expect(foraDoPrazo('2026-10-30', 3, '2026-11-05', cal)).toBe(false);
    expect(foraDoPrazo('2026-10-30', 3, '2026-11-06', cal)).toBe(true);
  });
});

describe('numeroProtocolo', () => {
  it('formata e interpreta', () => {
    expect(formatarNumeroProtocolo(2026, 123)).toBe('2026.000123');
    expect(parseNumeroProtocolo('2026.000123')).toEqual({ ano: 2026, sequencia: 123 });
    expect(parseNumeroProtocolo('2026-123')).toBeNull();
  });
  it('sequência reinicia por ano', () => {
    expect(proximoNumero(2026, ['2026.000009', '2025.000500'])).toBe('2026.000010');
    expect(proximoNumero(2027, ['2026.000009'])).toBe('2027.000001');
  });
});

describe('validarDados', () => {
  const tipo = {
    id: 'segunda_chamada',
    campos: [
      { id: 'materia_id', rotulo: 'Disciplina', tipo: 'materia' as const, obrigatorio: true },
      { id: 'obs', rotulo: 'Obs', tipo: 'text' as const },
    ],
    anexos: [{ id: 'comprovante', rotulo: 'Comprovante', obrigatorio: true, mimes: ['application/pdf'], multiplo: false }],
  };
  it('exige campos e anexos obrigatórios', () => {
    expect(validarDados(tipo, {}, [])).toEqual(['Campo obrigatório: Disciplina', 'Anexo obrigatório: Comprovante']);
  });
  it('aceita quando completo e barra múltiplos onde não pode', () => {
    const a = { tipo_anexo: 'comprovante', nome_arquivo: 'a.pdf', storage_path: 'x' };
    expect(validarDados(tipo, { materia_id: 'm' }, [a])).toEqual([]);
    expect(validarDados(tipo, { materia_id: 'm' }, [a, a])).toEqual(['Envie apenas um arquivo em: Comprovante']);
  });
  it('atividades complementares exigem certificado por item', () => {
    const t = { id: 'atividades_complementares', campos: [], anexos: [] };
    expect(validarDados(t, { itens: [{ descricao: 'X', horas_declaradas: 4 }] }, [])).toHaveLength(1);
    expect(validarDados(t, { itens: [{ descricao: 'X', horas_declaradas: 4, anexo_path: 'p' }] }, [])).toEqual([]);
  });
  it('abono: data final não pode ser anterior', () => {
    const t = { id: 'abono_faltas', campos: [], anexos: [] };
    expect(validarDados(t, { data_inicio: '2026-11-05', data_fim: '2026-11-04' }, [])).toHaveLength(1);
  });
  it('valida arquivo por tipo e tamanho', () => {
    const def = { rotulo: 'Doc', mimes: ['application/pdf'], max_mb: 10 };
    expect(validarArquivo(def, { type: 'application/pdf', size: 1000, name: 'a.pdf' })).toBeNull();
    expect(validarArquivo(def, { type: 'image/gif', size: 1000, name: 'a.gif' })).toMatch(/Formato/);
    expect(validarArquivo(def, { type: 'application/pdf', size: 11 * 1024 * 1024, name: 'a.pdf' })).toMatch(/10 MB/);
  });
  it('campos da ação', () => {
    const campos = [{ id: 'data_prova', rotulo: 'Data', tipo: 'date' as const, obrigatorio: true, acao: 'concluir' }];
    expect(camposAcaoFaltando(campos, 'concluir', {})).toEqual(['Data']);
    expect(camposAcaoFaltando(campos, 'deferir', {})).toEqual([]);
  });
});

describe('horasAC', () => {
  const cats = [{ id: 'eventos', nome: 'Eventos', limite_horas: 40 }, { id: 'cultural', nome: 'Cultural', limite_horas: 30 }];
  const itens = [{ descricao: 'Congresso', horas_declaradas: 30 }, { descricao: 'Semana', horas_declaradas: 20 }];
  it('saldo considera horas já lançadas', () => {
    expect(saldoPorCategoria(cats, { eventos: 35 })).toEqual({ eventos: 5, cultural: 30 });
  });
  it('limite da categoria soma os itens do mesmo pedido', () => {
    const av = [
      { indice: 0, autentico: true, categoria_id: 'eventos', horas_deferidas: 30 },
      { indice: 1, autentico: true, categoria_id: 'eventos', horas_deferidas: 20 },
    ];
    expect(validarAvaliacao(itens, av, cats, {})).toEqual(['Limite da categoria "Eventos" excedido: restam 10 h']);
  });
  it('não defere acima do declarado; ignora não autênticos', () => {
    expect(validarAvaliacao(itens, [{ indice: 1, autentico: true, categoria_id: 'cultural', horas_deferidas: 25 }], cats, {})).toHaveLength(1);
    const av = [{ indice: 0, autentico: false, horas_deferidas: 30 }, { indice: 1, autentico: true, categoria_id: 'cultural', horas_deferidas: 20 }];
    expect(validarAvaliacao(itens, av, cats, {})).toEqual([]);
    expect(totalDeferido(av)).toBe(20);
  });
});

import { parseData, parsePlanilhaAlunos } from './importAlunos';

describe('importAlunos', () => {
  const cursos = [{ id: 'ped', nome: 'Pedagogia' }];
  const turmas = [{ id: 't1', nome: 'PED 3', curso_id: 'ped' }];
  const cab = ['Matrícula', 'Nome', 'CPF', 'Data de nascimento', 'E-mail', 'Curso', 'Turma'];
  it('converte datas', () => {
    expect(parseData('02/01/2000')).toBe('2000-01-02');
    expect(parseData('2000-01-02')).toBe('2000-01-02');
    expect(parseData(36527)).toBe('2000-01-02');
    expect(parseData('31/02/2000')).toBe('');
  });
  it('valida linhas e marca duplicados', () => {
    const linhas = parsePlanilhaAlunos([
      cab,
      ['2026001', 'Maria  Silva', '123.456.789-09', '02/01/2000', 'm@x.com', 'Pedagogia', 'PED 3'],
      ['2026001', 'Outra', '52998224725', '02/01/2000', '', 'ped', ''],
      ['2026003', 'Zé', '111', 'x', '', 'Medicina', ''],
      ['2026004', 'Ana', 11144477735, '01/01/2001', '', 'ped', ''],
    ], cursos, turmas, { matriculas: new Set(), cpfs: new Set(['11144477735']) });
    expect(linhas[0]).toMatchObject({ nome: 'Maria Silva', cpf: '12345678909', curso_id: 'ped', turma_id: 't1', erros: [] });
    expect(linhas[1].erros).toContain('repetido no arquivo');
    expect(linhas[2].erros).toEqual(expect.arrayContaining(['CPF inválido', 'data de nascimento inválida', 'curso não encontrado']));
    expect(linhas[3].erros).toContain('já cadastrado');
  });
});
