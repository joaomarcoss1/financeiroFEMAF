import { describe, expect, it } from 'vitest';
import { ALFABETO, codigoValido, digitoVerificador, gerarCodigo, normalizarCodigo } from './codigo';
import { mascararCpf, mascararMatricula, mascararNome } from './mascarar';
import { dataHoraBR, renderDocumentoPdf, type EntradaPdf } from './renderPdf';
import { sha256Hex } from './sha256';

describe('codigo', () => {
  it('alfabeto sem caracteres ambíguos', () => {
    expect(ALFABETO).toHaveLength(32);
    for (const c of '0O1I') expect(ALFABETO).not.toContain(c);
  });
  it('gera no formato e com dígito verificador válido', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const c = gerarCodigo(rnd);
      expect(c).toMatch(/^IPD-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(codigoValido(c)).toBe(true);
    }
  });
  it('detecta erro de digitação em um caractere', () => {
    const c = `IPD-ABCD-EFG${digitoVerificador('ABCDEFG')}`;
    expect(codigoValido(c)).toBe(true);
    expect(codigoValido(c.replace('ABCD', 'ABCE'))).toBe(false);
  });
  it('normaliza entrada do usuário', () => {
    expect(normalizarCodigo(' ipd abcd efgh ')).toBe('IPD-ABCD-EFGH');
    expect(normalizarCodigo('IPD-ABCD-EFG0')).toBeNull();
  });
});

describe('mascarar', () => {
  it('nome', () => {
    expect(mascararNome('Maria Silva de Oliveira')).toBe('Maria S*** O***');
    expect(mascararNome('  João  ')).toBe('João');
  });
  it('cpf e matrícula', () => {
    expect(mascararCpf('123.456.789-09')).toBe('***.456.789-**');
    expect(mascararMatricula('2026001')).toBe('****001');
  });
});

describe('renderPdf', () => {
  const entrada: EntradaPdf = {
    codigo: 'IPD-ABCD-EFGH',
    status: 'assinado',
    urlValidacao: 'https://exemplo.app/validar/IPD-ABCD-EFGH',
    snapshot: {
      modelo: 'deferimento_segunda_chamada',
      modelo_nome: 'Deferimento de segunda chamada',
      titulo: 'Deferimento de segunda chamada — 2026.000001',
      emitido_em: '2026-11-05T10:30:00',
      aluno: { nome: 'Maria Silva de Oliveira', matricula: '2026001', cpf: '12345678909', curso_nome: 'Pedagogia', turma: 'PED 3' },
      protocolo: {
        numero: '2026.000001', tipo_id: 'segunda_chamada', tipo_nome: 'Segunda chamada', aberto_em: '2026-11-03T19:00:00',
        status: 'concluido', decisao: 'deferido', parecer_final: null, fora_do_prazo: true,
        dados: { avaliacao: 'AV1', data_avaliacao: '2026-11-02', agendamento: { data_prova: '2026-11-20', horario: '19h', local: 'Sala 3', taxa_valor: 30 } },
      },
      disciplina: 'Didática',
      professor: 'Prof Beto',
    },
    assinaturas: [
      { ordem: 2, papel: 'secretaria', cargo: 'Secretaria Acadêmica', nome_signatario: 'Ana', status: 'assinado', assinado_em: '2026-11-05T14:00:00+00:00', sha256_snapshot: 'a'.repeat(64) },
      { ordem: 1, papel: 'coordenador', cargo: 'Coordenação', nome_signatario: 'Beto', status: 'assinado', assinado_em: '2026-11-05T13:00:00+00:00', sha256_snapshot: 'a'.repeat(64) },
    ],
  };

  it('gera PDF sem erro e é determinístico', async () => {
    const a = await renderDocumentoPdf(entrada);
    const b = await renderDocumentoPdf(structuredClone(entrada));
    expect(new TextDecoder().decode(a.slice(0, 5))).toBe('%PDF-');
    expect(a.length).toBeGreaterThan(1000);
    expect(await sha256Hex(a)).toBe(await sha256Hex(b));
  });
  it('conteúdo diferente muda o hash', async () => {
    const a = await renderDocumentoPdf(entrada);
    const c = await renderDocumentoPdf({ ...entrada, status: 'aguardando_assinatura' });
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(c));
  });
  it('renderiza os demais modelos', async () => {
    for (const modelo of ['comprovante_protocolo', 'parecer_protocolo', 'termo_aceite_tcc', 'homologacao_tcc', 'extrato_horas', 'declaracao']) {
      const pdf = await renderDocumentoPdf({
        ...entrada,
        snapshot: { ...entrada.snapshot, modelo, texto: 'Declaramos para os devidos fins.', horas: [{ categoria: 'Eventos', descricao: 'Congresso', horas_declaradas: 10, horas_deferidas: 8, data: '2026-10-01' }], total_horas: 8 },
      });
      expect(pdf.length).toBeGreaterThan(1000);
    }
  });
  it('data/hora em Fortaleza independe do fuso da máquina', () => {
    expect(dataHoraBR('2026-11-05T13:49:33.398+00:00')).toBe('05/11/2026 10:49');
    expect(dataHoraBR('2026-11-05T10:30:00')).toBe('05/11/2026 10:30');
  });
});
