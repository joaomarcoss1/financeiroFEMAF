// Motor de leitura/escrita de PDF compartilhado pelas Edge Functions de Provas.
// Leitura de texto/posições: unpdf (build de pdfjs pronta para runtimes serverless/edge,
// sem dependência de DOM/Canvas — funciona no Deno das Edge Functions).
// Escrita/overlay/merge: pdf-lib.
import { getDocumentProxy, getResolvedPDFJS } from "https://esm.sh/unpdf@0.11.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

export interface TextItemPos {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number; // 0-based
}

export interface PdfPageText {
  page: number;
  text: string;
  items: TextItemPos[];
}

// Extrai o texto (e posições de cada fragmento) de todas as páginas do PDF.
// IMPORTANTE: o pdfjs (usado por getDocumentProxy) transfere/desanexa o
// ArrayBuffer do Uint8Array de entrada como otimização — passar uma cópia
// evita que o buffer original do chamador fique inutilizável depois (ex.:
// reutilizado em várias chamadas de overlayFields no mesmo lote).
export async function extractPdfPages(bytes: Uint8Array): Promise<PdfPageText[]> {
  const pdf = await getDocumentProxy(bytes.slice());
  const { getDocument } = await getResolvedPDFJS();
  void getDocument; // referência mantida para builds que exigem o import ativo
  const pages: PdfPageText[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items: TextItemPos[] = [];
    let text = "";
    for (const raw of content.items as any[]) {
      if (typeof raw.str !== "string") continue;
      const tr = raw.transform as number[];
      items.push({
        str: raw.str,
        x: tr[4],
        y: tr[5],
        width: raw.width ?? 0,
        height: raw.height ?? Math.abs(tr[3] || 10),
        page: i - 1,
      });
      text += raw.str + (raw.hasEOL ? "\n" : "");
    }
    pages.push({ page: i - 1, text, items });
  }
  return pages;
}

export function fullText(pages: PdfPageText[]): string {
  return pages.map((p) => p.text).join("\n");
}

// Localiza a posição (x,y) de um rótulo/âncora de texto (ex.: "Aluno(a)"), juntando
// fragmentos adjacentes da mesma linha para tolerar rótulos quebrados em vários runs.
export function findAnchor(pages: PdfPageText[], anchor: string): TextItemPos | null {
  const needle = normalize(anchor);
  for (const p of pages) {
    // Agrupa itens por linha (mesma coordenada y, tolerância de 2pt) e concatena o texto
    const byLine = new Map<string, TextItemPos[]>();
    for (const it of p.items) {
      const key = `${p.page}:${Math.round(it.y / 2) * 2}`;
      if (!byLine.has(key)) byLine.set(key, []);
      byLine.get(key)!.push(it);
    }
    for (const line of byLine.values()) {
      line.sort((a, b) => a.x - b.x);
      // pdf.js insere itens de espaço "fantasma" (ex.: str: " ") para representar
      // lacunas largas entre fragmentos de uma mesma linha (comum em cabeçalhos de
      // duas colunas, como "Professor: ___   Curso: ___"). normalize() faz trim() —
      // então normalizar o acumulado a cada passo (como antes) apaga esse espaço só
      // quando ele cai no fim do prefixo, e o comprimento acumulado nunca alcança o
      // alvo calculado sobre a linha inteira. Por isso o comprimento acumulado de
      // cada prefixo é recalculado a partir do texto bruto completo até ali (mesma
      // função normalize aplicada de forma consistente), em vez de normalizar
      // incrementalmente cima de um resultado já normalizado/aparado.
      let rawAcc = "";
      const cumLen: number[] = [];
      for (const it of line) {
        rawAcc += it.str;
        cumLen.push(normalize(rawAcc).length);
      }
      const joined = normalize(rawAcc);
      const idx = joined.indexOf(needle);
      if (idx === -1) continue;
      const alvo = idx + needle.length;

      // A âncora pode se espalhar por vários itens (ex.: "Aluno(a) /" e
      // "Assinatura:" são dois fragmentos distintos do mesmo rótulo). O
      // item onde a âncora COMEÇA é o primeiro cujo comprimento acumulado
      // (do início da linha) já passa do índice inicial do match; o item
      // onde ela TERMINA é o primeiro cujo comprimento acumulado alcança o
      // fim do match. Sem isso, usar só a largura do último fragmento
      // ("Assinatura:") para centralizar o valor abaixo do rótulo inteiro
      // ("Aluno(a) / Assinatura:") desloca o centro para a direita, na
      // direção do fragmento final, em vez do meio do texto completo.
      let startIdx = 0;
      for (let i = 0; i < line.length; i++) {
        if (cumLen[i] > idx) { startIdx = i; break; }
      }
      let endIdx = line.length - 1;
      for (let i = 0; i < line.length; i++) {
        if (cumLen[i] >= alvo) { endIdx = i; break; }
      }

      const startItem = line[startIdx];
      const endItem = line[endIdx];
      const xFim = endItem.x + endItem.width;
      return {
        ...endItem,
        x: xFim,
        width: xFim - startItem.x,
        height: Math.max(startItem.height, endItem.height),
      };
    }
  }
  return null;
}

function normalize(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface OverlayField {
  anchor: string;
  valor: string;
  offsetX?: number;
  offsetY?: number;
  maxWidth?: number;
  /**
   * 'inline' (padrão): o valor vai logo após o rótulo, na mesma linha —
   * modelo em que o rótulo e a lacuna de preenchimento ficam lado a lado
   * ("Rótulo: ______").
   *
   * 'center-below': o valor vai centralizado uma linha abaixo do rótulo —
   * sempre que couber. Se o valor for comprido a ponto de a centralização
   * jogá-lo para antes do início do próprio rótulo (invadindo a célula
   * vizinha à esquerda), o texto é preso à borda esquerda da célula em vez
   * de centralizar (ver clamp em `inicioRotulo` abaixo). Usado em
   * Curso/Disciplina/Período/Data/Avaliação (rótulo e valor centralizados
   * no .docx oficial) e também em Aluno(a)/Assinatura — embora esse rótulo
   * não tenha `w:jc` definido no .docx (alinhamento padrão à esquerda),
   * visualmente, com o resto do cabeçalho centralizado, um nome alinhado à
   * esquerda destoava (feedback do usuário conferindo um lote real).
   *
   * 'left-below': o valor vai sempre alinhado à esquerda (começando no
   * mesmo x onde o rótulo começa) uma linha abaixo dele, sem tentar
   * centralizar.
   */
  mode?: "inline" | "center-below" | "left-below";
}

// Sobrepõe valores no PDF nas posições detectadas dos rótulos. Escreve o
// texto diretamente sobre o campo (sem nenhum retângulo de cobertura por
// baixo) — os campos do modelo ficam em branco à espera do preenchimento,
// então não há nada ali para "esconder", e um retângulo branco só criava um
// remendo visível sempre que a página não fosse um branco puro uniforme
// (textura de digitalização, linha do campo, sombreado de tabela). O
// tamanho da fonte acompanha a altura detectada do próprio rótulo, para o
// preenchimento ficar no mesmo peso visual do restante do formulário — como
// se tivesse sido digitado no documento original, não colado por cima dele.
export async function overlayFields(bytes: Uint8Array, pages: PdfPageText[], fields: OverlayField[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pdfPages = doc.getPages();

  for (const field of fields) {
    if (!field.valor) continue;
    const pos = findAnchor(pages, field.anchor);
    if (!pos) continue; // âncora não encontrada nesta prova: ignora silenciosamente
    const page = pdfPages[pos.page];
    if (!page) continue;
    const fontSize = Math.max(9, Math.min(11, pos.height || 10));
    const maxWidth = field.maxWidth ?? 220;
    const texto = truncateToWidth(field.valor, font, fontSize, maxWidth);
    const larguraTexto = font.widthOfTextAtSize(texto, fontSize);

    // pos.x é o fim do trecho casado (ver findAnchor) e pos.width é a
    // largura TOTAL do rótulo (do primeiro ao último fragmento que o
    // compõem) — logo pos.x - pos.width é o início do rótulo.
    const inicioRotulo = pos.x - pos.width;
    const alturaLinha = (pos.height || fontSize) * 1.2;

    let x: number;
    let y: number;
    if (field.mode === "center-below") {
      const centroRotulo = inicioRotulo + pos.width / 2;
      x = centroRotulo - larguraTexto / 2 + (field.offsetX ?? 0);
      // Um valor comprido, centralizado sob um rótulo estreito, pode
      // começar mais à esquerda do que o próprio início do rótulo —
      // invadindo visualmente a célula vizinha à esquerda (ex.: um nome
      // de aluno longo, centralizado sob "Aluno(a) / Assinatura:",
      // sobrepondo o nome do professor na célula ao lado). Por isso nunca
      // deixa o texto começar antes do início do rótulo: fica centralizado
      // quando cabe, e cola na borda esquerda da própria célula quando não
      // cabe — nunca invade a célula anterior.
      x = Math.max(x, inicioRotulo);
      y = pos.y - alturaLinha + (field.offsetY ?? 0);
    } else if (field.mode === "left-below") {
      x = inicioRotulo + (field.offsetX ?? 0);
      y = pos.y - alturaLinha + (field.offsetY ?? 0);
    } else {
      x = pos.x + (field.offsetX ?? 4);
      y = pos.y + (field.offsetY ?? 0);
    }

    page.drawText(texto, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.08, 0.08, 0.08),
    });
  }

  return await doc.save();
}

function truncateToWidth(text: string, font: any, size: number, maxWidth: number): string {
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(out, size) > maxWidth) {
    out = out.slice(0, -1);
  }
  return out;
}

// Mescla vários PDFs (bytes) em um único PDF, na ordem informada.
export async function mergePdfs(pdfList: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of pdfList) {
    const src = await PDFDocument.load(bytes);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  return await merged.save();
}
