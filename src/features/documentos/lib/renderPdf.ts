import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { mascararCpf } from './mascarar';

// Renderização pura e determinística: mesmo snapshot + assinaturas + código ⇒ mesmos bytes.
// Não usa relógio, fuso da máquina nem canvas (o QR é desenhado com retângulos).

export interface SnapshotDocumento {
  modelo: string;
  modelo_nome: string;
  titulo: string;
  emitido_em: string; // horário local de Fortaleza, sem fuso
  aluno?: { nome: string; matricula: string; cpf?: string; curso_id?: string; curso_nome?: string; turma?: string | null } | null;
  protocolo?: {
    numero: string; tipo_id: string; tipo_nome: string; aberto_em: string; status: string;
    decisao: string | null; parecer_final: string | null; fora_do_prazo?: boolean; dados: Record<string, unknown>;
  } | null;
  texto?: string | null;
  disciplina?: string | null;
  professor?: string | null;
  tcc?: { titulo?: string; situacao?: string; nota_final?: number | null; orientador?: string | null } | null;
  horas?: { categoria: string; descricao: string; emissor?: string | null; data?: string | null; horas_declaradas: number; horas_deferidas: number; deste_protocolo?: boolean }[];
  total_horas?: number;
}

export interface AssinaturaRender {
  ordem: number;
  papel: string;
  cargo: string | null;
  nome_signatario: string | null;
  status: 'pendente' | 'assinado' | 'recusado';
  assinado_em: string | null;
  sha256_snapshot?: string | null;
}

export interface EntradaPdf {
  snapshot: SnapshotDocumento;
  assinaturas: AssinaturaRender[];
  codigo: string;
  status: 'aguardando_assinatura' | 'assinado' | 'cancelado';
  urlValidacao: string;
  logoDataUrl?: string;
}

const AZUL_FEMAF: [number, number, number] = [30, 17, 128];
const M = 20; // margem (mm)
const L = 210 - 2 * M;

/** ISO com fuso → "dd/mm/aaaa hh:mm" em America/Fortaleza (UTC-3 fixo, sem horário de verão). */
export function dataHoraBR(valor: string | null | undefined): string {
  if (!valor) return '';
  const temFuso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(valor);
  const d = new Date(temFuso ? valor : `${valor.slice(0, 19)}Z`);
  if (Number.isNaN(d.getTime())) return valor;
  const f = new Date(d.getTime() - (temFuso ? 3 * 3600_000 : 0));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(f.getUTCDate())}/${p(f.getUTCMonth() + 1)}/${f.getUTCFullYear()} ${p(f.getUTCHours())}:${p(f.getUTCMinutes())}`;
}
export const dataBR = (v: string | null | undefined) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : '');

function corpo(s: SnapshotDocumento): string[] {
  const a = s.aluno;
  const p = s.protocolo;
  const d = (p?.dados ?? {}) as Record<string, string | number | undefined>;
  const quem = a ? `${a.nome}, matrícula ${a.matricula}${a.curso_nome ? `, do curso de ${a.curso_nome}` : ''}${a.turma ? `, turma ${a.turma}` : ''}` : '';
  switch (s.modelo) {
    case 'comprovante_protocolo':
      return [
        `Certificamos que ${quem} protocolou em ${dataHoraBR(p?.aberto_em)} o requerimento nº ${p?.numero} — ${p?.tipo_nome}.`,
        'O requerente declarou, por aceite eletrônico, que as informações prestadas são verdadeiras.',
        'Acompanhe o andamento pela Central do Aluno.',
      ];
    case 'parecer_protocolo':
      return [
        `Requerimento nº ${p?.numero} — ${p?.tipo_nome}, apresentado por ${quem}.`,
        `Decisão: ${(p?.decisao ?? '').toUpperCase()}.`,
        `Parecer: ${p?.parecer_final || 'sem observações.'}`,
      ];
    case 'deferimento_segunda_chamada': {
      const ag = (d.agendamento ?? {}) as unknown as Record<string, string | number | undefined>;
      return [
        `Fica DEFERIDO o pedido de segunda chamada nº ${p?.numero}, apresentado por ${quem}.`,
        `Disciplina: ${s.disciplina ?? '-'}${s.professor ? ` — Prof(a). ${s.professor}` : ''}. Avaliação: ${d.avaliacao ?? '-'}, perdida em ${dataBR(String(d.data_avaliacao ?? ''))}.`,
        `A avaliação será aplicada em ${dataBR(String(ag.data_prova ?? ''))}, às ${ag.horario ?? '-'}, no local: ${ag.local ?? '-'}.`,
        ag.taxa_valor ? `Taxa: R$ ${Number(ag.taxa_valor).toFixed(2).replace('.', ',')}${ag.boleto_link ? ` — boleto: ${ag.boleto_link}` : ''}.` : 'Sem taxa.',
        ...(p?.fora_do_prazo ? ['Pedido apresentado fora do prazo regimental e acolhido pela coordenação.'] : []),
      ];
    }
    case 'termo_aceite_tcc':
      return [
        `Declaramos aceito o projeto de Trabalho de Conclusão de Curso de ${quem} (protocolo nº ${p?.numero}).`,
        `Título: ${s.tcc?.titulo ?? d.titulo ?? '-'}.`,
        `Orientador(a): ${s.tcc?.orientador ?? '-'}${d.coorientador ? `. Coorientador(a): ${d.coorientador}` : ''}. Linha de pesquisa: ${d.linha_pesquisa ?? '-'}.`,
      ];
    case 'homologacao_tcc':
      return [
        `Homologamos o Trabalho de Conclusão de Curso de ${quem} (protocolo nº ${p?.numero}).`,
        `Título: ${s.tcc?.titulo ?? d.titulo_final ?? '-'}. Orientador(a): ${s.tcc?.orientador ?? '-'}.`,
        `Defesa em ${dataBR(String(d.data_defesa ?? ''))}. Banca: ${d.banca ?? '-'}.`,
        `Nota final homologada: ${s.tcc?.nota_final ?? d.nota_homologada ?? '-'}.`,
      ];
    case 'extrato_horas':
      return [`Extrato de horas complementares deferidas de ${quem}${p ? ` (protocolo nº ${p.numero})` : ''}.`];
    default:
      return [...(quem ? [`Titular: ${quem}.`] : []), ...(s.texto ?? '').split(/\n+/).filter(Boolean)];
  }
}

function desenharQr(doc: jsPDF, texto: string, x: number, y: number, tamanho: number) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const c = tamanho / n;
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(r, col)) doc.rect(x + col * c, y + r * c, c, c, 'F');
    }
  }
}

export async function renderDocumentoPdf(e: EntradaPdf): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const s = e.snapshot;
  // determinismo: data de criação e ID do arquivo derivados do snapshot/código
  const criado = new Date(`${(s.emitido_em || '2000-01-01T00:00:00').slice(0, 19)}Z`);
  doc.setCreationDate(Number.isNaN(criado.getTime()) ? new Date(0) : criado);
  doc.setFileId(Array.from(e.codigo.padEnd(16, '0').slice(0, 16)).map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('').toUpperCase());
  doc.setProperties({ title: s.titulo, subject: s.modelo_nome, author: 'FEMAF', creator: 'Plataforma de Gestão Financeira FEMAF' });

  const cabecalho = () => {
    doc.setFillColor(...AZUL_FEMAF);
    doc.rect(0, 0, 210, 4, 'F');
    if (e.logoDataUrl) {
      try { doc.addImage(e.logoDataUrl, 'PNG', M, 10, 26, 20); } catch { /* logo opcional */ }
    }
    doc.setTextColor(...AZUL_FEMAF);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO', M + 30, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text('Secretaria Acadêmica', M + 30, 24);
    doc.setDrawColor(...AZUL_FEMAF);
    doc.line(M, 36, 210 - M, 36);
  };
  const rodape = (pagina: number, total: number) => {
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(`Código de validação: ${e.codigo}`, M, 285);
    doc.text(`Valide em ${e.urlValidacao}`, M, 289);
    doc.text(`Página ${pagina} de ${total}`, 210 - M, 289, { align: 'right' });
  };
  const marcaDagua = () => {
    if (e.status === 'assinado') return;
    doc.setTextColor(200, 200, 200);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.text(e.status === 'cancelado' ? 'DOCUMENTO CANCELADO' : 'PRÉVIA — AGUARDANDO ASSINATURAS', 105, 160, { align: 'center', angle: 30 });
  };

  cabecalho();
  marcaDagua();
  let y = 50;
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(s.modelo_nome.toUpperCase(), 105, y, { align: 'center' });
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const novaPaginaSe = (alturaNecessaria: number) => {
    if (y + alturaNecessaria > 265) { doc.addPage(); cabecalho(); marcaDagua(); y = 48; doc.setTextColor(20, 20, 20); doc.setFont('helvetica', 'normal'); doc.setFontSize(11); }
  };
  for (const par of corpo(s)) {
    const linhas = doc.splitTextToSize(par, L) as string[];
    novaPaginaSe(linhas.length * 5.5);
    doc.text(linhas, M, y, { align: 'justify', maxWidth: L });
    y += linhas.length * 5.5 + 3;
  }

  if (s.modelo === 'extrato_horas' && s.horas?.length) {
    y += 2;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const cols = [M, M + 22, M + 70, M + 135, M + 152];
    novaPaginaSe(8);
    ['Data', 'Categoria', 'Atividade', 'Declar.', 'Deferidas'].forEach((t, i) => doc.text(t, cols[i], y));
    y += 5;
    doc.setFont('helvetica', 'normal');
    for (const h of s.horas) {
      const desc = doc.splitTextToSize(h.descricao, 62) as string[];
      novaPaginaSe(desc.length * 4.5 + 2);
      doc.text(dataBR(h.data ?? ''), cols[0], y);
      doc.text(doc.splitTextToSize(h.categoria, 46) as string[], cols[1], y);
      doc.text(desc, cols[2], y);
      doc.text(String(h.horas_declaradas), cols[3], y);
      doc.text(String(h.horas_deferidas), cols[4], y);
      y += Math.max(desc.length, 2) * 4.5 + 1;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`Total deferido: ${s.total_horas ?? 0} h`, 210 - M, y + 2, { align: 'right' });
    y += 10;
    doc.setFontSize(11);
  }

  y += 4;
  novaPaginaSe(10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Emitido em ${dataHoraBR(s.emitido_em)}.`, M, y);
  y += 12;

  for (const a of [...e.assinaturas].sort((x, z) => x.ordem - z.ordem)) {
    novaPaginaSe(22);
    doc.setDrawColor(120, 120, 120);
    doc.line(M + 30, y, 210 - M - 30, y);
    doc.setFont('helvetica', 'bold');
    doc.text(a.nome_signatario ?? '(assinatura pendente)', 105, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(a.cargo ?? a.papel, 105, y + 10, { align: 'center' });
    doc.setFontSize(8);
    doc.text(a.status === 'assinado' ? `Assinado eletronicamente em ${dataHoraBR(a.assinado_em)}` : 'Pendente', 105, y + 14, { align: 'center' });
    doc.setFontSize(10);
    y += 22;
  }

  desenharQr(doc, e.urlValidacao, 210 - M - 26, 250, 26);

  if (e.status === 'assinado') {
    doc.addPage();
    cabecalho();
    y = 50;
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('MANIFESTO DE ASSINATURAS', 105, y, { align: 'center' });
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const intro = doc.splitTextToSize(
      `Documento "${s.titulo}", código ${e.codigo}, assinado eletronicamente com reautenticação do signatário, nos termos da Lei 14.063/2020. ` +
      'Cada assinatura registra data, hora e o resumo SHA-256 do conteúdo assinado.', L) as string[];
    doc.text(intro, M, y);
    y += intro.length * 4.5 + 6;
    for (const a of [...e.assinaturas].sort((x, z) => x.ordem - z.ordem)) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${a.ordem}. ${a.nome_signatario ?? '-'} — ${a.cargo ?? a.papel}`, M, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`Assinado em ${dataHoraBR(a.assinado_em)}`, M + 4, y + 5);
      if (a.sha256_snapshot) doc.text(`SHA-256 do conteúdo: ${a.sha256_snapshot}`, M + 4, y + 10);
      y += 17;
    }
    if (s.aluno?.cpf) doc.text(`Titular: ${s.aluno.nome} — CPF ${mascararCpf(s.aluno.cpf)}`, M, y + 4);
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); rodape(i, total); }
  return new Uint8Array(doc.output('arraybuffer'));
}

/** Carrega uma imagem (ex.: logo importado pelo Vite) como data URL para o PDF. */
export async function carregarDataUrl(url: string): Promise<string | undefined> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(blob); });
  } catch { return undefined; }
}
