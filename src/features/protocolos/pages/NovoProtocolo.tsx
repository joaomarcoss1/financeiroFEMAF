import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import CentralLayout from '../layouts/CentralLayout';
import { FormularioDinamico } from '../components/FormularioDinamico';
import { AnexosUploader } from '../components/AnexosUploader';
import { ItensAtividadeComplementar, type ItemEdicao } from '../components/ItensAtividadeComplementar';
import { DadosProtocolo } from '../components/DadosProtocolo';
import { Carregando, Erro } from '../components/Estados';
import { Secao } from '../components/Secao';
import Selo from '../components/identidade/Selo';
import { useAbrirProtocolo, useCalendario, useCategoriasAC, useDisciplinasAluno, useProfessoresNomes, useTipos } from '../api/protocolos';
import { enviarAnexo } from '../api/uploads';
import { validarDados } from '../lib/validarDados';
import { calendarioMap, foraDoPrazo, hojeIso } from '../lib/prazos';
import type { AnexoEnviado, TipoProtocolo } from '../lib/types';
import { baixarBlob, obterPdf } from '@/features/documentos/api/documentos';
import { rpc } from '../api/db';
import type { ProtocoloDetalhe } from '../lib/types';

const RASCUNHO = 'central:rascunho-protocolo';
interface Rascunho { tipoId: string; dados: Record<string, unknown>; itens: ItemEdicao[] }

function lerRascunho(): Rascunho | null {
  try { return JSON.parse(localStorage.getItem(RASCUNHO) ?? 'null'); } catch { return null; }
}
function gravarRascunho(r: Rascunho | null) {
  try { if (r) localStorage.setItem(RASCUNHO, JSON.stringify(r)); else localStorage.removeItem(RASCUNHO); } catch { /* armazenamento indisponível */ }
}

/** Datas (ISO) entre início e fim cujos dias da semana têm aula da disciplina. */
function sugerirDisciplinas(inicio: string, fim: string, disciplinas: { materia_id: string; dias_semana: number[] }[]) {
  if (!inicio || !fim || fim < inicio) return [];
  const dias = new Set<number>();
  const d = new Date(`${inicio}T12:00:00`);
  const f = new Date(`${fim}T12:00:00`);
  for (let i = 0; d <= f && i < 60; i++, d.setDate(d.getDate() + 1)) dias.add(d.getDay());
  return disciplinas.filter((x) => x.dias_semana.some((s) => dias.has(s))).map((x) => x.materia_id);
}

export default function NovoProtocolo() {
  const { alunoId } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: tipos, isLoading, error } = useTipos();
  const inicial = useMemo(lerRascunho, []);
  const [passo, setPasso] = useState(inicial?.tipoId ? 2 : 1);
  const [tipoId, setTipoId] = useState(inicial?.tipoId ?? '');
  const [dados, setDados] = useState<Record<string, unknown>>(inicial?.dados ?? {});
  const [itens, setItens] = useState<ItemEdicao[]>(inicial?.itens?.map((i) => ({ ...i, arquivo: undefined })) ?? []);
  const [arquivos, setArquivos] = useState<Record<string, File[]>>({});
  const [aceite, setAceite] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [protocoloId] = useState(() => crypto.randomUUID());
  const [resultado, setResultado] = useState<{ id: string; numero: string; fora_do_prazo: boolean } | null>(null);
  const abrir = useAbrirProtocolo();

  const tipo = tipos?.find((t) => t.id === tipoId);
  const ehAC = tipo?.id === 'atividades_complementares';
  const precisaDisciplinas = !!tipo?.campos.some((c) => c.tipo === 'materia' || c.tipo === 'materias');
  const precisaProfessores = !!tipo?.campos.some((c) => c.tipo === 'professor');
  const { data: disciplinas = [] } = useDisciplinasAluno(precisaDisciplinas);
  const { data: professores = [] } = useProfessoresNomes(precisaProfessores);
  const { data: categorias = [] } = useCategoriasAC();
  const { data: calendario = [] } = useCalendario();

  useEffect(() => {
    if (!resultado) gravarRascunho(tipoId ? { tipoId, dados, itens: itens.map(({ arquivo: _a, ...i }) => i) } : null);
  }, [tipoId, dados, itens, resultado]);

  const dadosFinais = useMemo(() => (ehAC ? { ...dados, itens } : dados), [dados, itens, ehAC]);
  const errosCampos = tipo
    ? validarDados({ ...tipo, anexos: [] }, ehAC ? { ...dados, itens: itens.map((i) => ({ ...i, anexo_path: i.arquivo ? 'ok' : '' })) } : dados, [])
    : [];
  const anexosSimulados: AnexoEnviado[] = ehAC
    ? itens.filter((i) => i.arquivo).map(() => ({ tipo_anexo: 'certificado', nome_arquivo: '', storage_path: '' }))
    : Object.entries(arquivos).flatMap(([k, fs]) => fs.map(() => ({ tipo_anexo: k, nome_arquivo: '', storage_path: '' })));
  const errosAnexos = tipo ? validarDados({ id: '', campos: [], anexos: tipo.anexos }, {}, anexosSimulados) : [];

  const prazo = tipo?.prazo_regimental;
  const dataRef = prazo ? String(dados[prazo.campo] ?? '') : '';
  const atrasado = !!(prazo && dataRef && foraDoPrazo(dataRef, prazo.dias_uteis, hojeIso(), calendarioMap(calendario)));

  if (isLoading) return <CentralLayout titulo="Novo protocolo"><Carregando /></CentralLayout>;
  if (error) return <CentralLayout titulo="Novo protocolo"><Erro erro={error} /></CentralLayout>;

  function escolher(t: TipoProtocolo) {
    if (t.id !== tipoId) { setDados({}); setItens(t.id === 'atividades_complementares' ? [{ descricao: '', horas_declaradas: 0 }] : []); setArquivos({}); }
    setTipoId(t.id);
    setPasso(2);
  }

  async function enviar() {
    if (!tipo || !alunoId) return;
    const lista: { file: File; tipo: string; item?: number }[] = ehAC
      ? itens.map((i, idx) => ({ file: i.arquivo!, tipo: 'certificado', item: idx }))
      : Object.entries(arquivos).flatMap(([k, fs]) => fs.map((file) => ({ file, tipo: k })));
    try {
      setProgresso(0);
      const anexos: AnexoEnviado[] = [];
      const itensFinais = itens.map(({ arquivo: _a, ...i }) => ({ ...i }));
      for (let i = 0; i < lista.length; i++) {
        const a = await enviarAnexo(alunoId, protocoloId, lista[i].file, lista[i].tipo);
        anexos.push(a);
        if (lista[i].item !== undefined) itensFinais[lista[i].item!].anexo_path = a.storage_path;
        setProgresso(Math.round(((i + 1) / lista.length) * 90));
      }
      const r = await abrir.mutateAsync({ id: protocoloId, tipo: tipo.id, dados: ehAC ? { ...dados, itens: itensFinais } : dados, anexos });
      setProgresso(100);
      gravarRascunho(null);
      setResultado(r);
    } catch (e) {
      setProgresso(null);
      toast({ title: 'Não foi possível protocolar', description: (e as Error).message, variant: 'destructive' });
    }
  }

  async function comprovante() {
    if (!resultado) return;
    try {
      const det = await rpc<ProtocoloDetalhe>('protocolo_detalhe', { p_id: resultado.id });
      const doc = det.documentos[0];
      if (!doc) throw new Error('Comprovante ainda não disponível.');
      const { blob, nome } = await obterPdf(doc.id);
      baixarBlob(blob, nome);
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  }

  if (resultado) {
    return (
      <CentralLayout>
        <div className="inst-entrar mx-auto max-w-xl rounded-md border border-border border-t-4 border-t-[hsl(201_78%_52%)] bg-card p-8 text-center">
          <Selo texto="Protocolo registrado" className="mx-auto h-32 w-32" />
          <p className="inst-kicker mt-4">Protocolo registrado</p>
          <p className="mt-1 inst-num text-3xl font-semibold tracking-wide">{resultado.numero}</p>
          <p className="mt-2 text-sm text-muted-foreground">Guarde este número. Você recebe um aviso a cada movimentação.</p>
          {resultado.fora_do_prazo && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Registrado fora do prazo regimental; a coordenação vai decidir.</p>}
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Button className="h-11 rounded-md" onClick={comprovante}><Download className="h-4 w-4" /> Comprovante</Button>
            <Button variant="outline" className="h-11 rounded-md" onClick={() => navigate(`/central/protocolos/${resultado.id}`)}>Acompanhar</Button>
          </div>
        </div>
      </CentralLayout>
    );
  }

  const passos = ['Tipo de pedido', 'Dados', 'Anexos', 'Revisão'];
  const voltarBtn = (para: number, rotulo: string) => (
    <Button variant="ghost" className="rounded-md" onClick={() => setPasso(para)} disabled={progresso !== null}><ChevronLeft className="h-4 w-4" /> {rotulo}</Button>
  );

  return (
    <CentralLayout titulo="Novo protocolo" subtitulo="Pedidos à Secretaria Acadêmica e à Coordenação de Curso.">
      <ol className="mb-6 grid grid-cols-4 border-b border-border text-xs sm:text-sm" aria-label="Etapas">
        {passos.map((n, i) => (
          <li key={n} aria-current={passo === i + 1 ? 'step' : undefined}
            className={cn('-mb-px border-b-2 pb-2.5', passo === i + 1 ? 'border-primary font-semibold text-foreground' : passo > i + 1 ? 'border-primary/40 text-foreground/70' : 'border-transparent text-muted-foreground')}>
            <span className="tabular-nums">{i + 1}.</span> <span className={cn(passo !== i + 1 && 'hidden sm:inline')}>{n}</span>
          </li>
        ))}
      </ol>

      {passo === 1 && (
        <Secao titulo="Escolha o tipo de pedido" semCorpo>
          <ul className="inst-list">
            {(tipos ?? []).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => escolher(t)} className={cn('inst-row group w-full text-left', t.id === tipoId && 'bg-primary/5')}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t.nome}</span>
                    <span className="block text-sm text-muted-foreground">{t.descricao}</span>
                    <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {t.anexos.map((a) => <span key={a.id} className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{a.rotulo}{a.obrigatorio ? '' : ' (opcional)'}</span>)}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {tipo && passo === 2 && (
        <Secao titulo={tipo.nome}>
          <div className="space-y-5">
            {tipo.instrucoes_aluno && <p className="border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">{tipo.instrucoes_aluno}</p>}
            <FormularioDinamico
              campos={tipo.campos}
              valores={dados}
              ignorar={['itens_ac']}
              onChange={(id, v) => setDados((d) => ({ ...d, [id]: v }))}
              contexto={{
                disciplinas,
                professores,
                aoEscolherMateria: (d) => setDados((x) => ({ ...x, professor_id: d?.professor_id ?? x.professor_id })),
              }}
            />
            {tipo.id === 'abono_faltas' && (() => {
              const sug = sugerirDisciplinas(String(dados.data_inicio ?? ''), String(dados.data_fim ?? ''), disciplinas);
              return sug.length > 0 && (
                <Button type="button" variant="outline" size="sm" className="rounded-md" onClick={() => setDados((d) => ({ ...d, disciplinas: sug }))}>
                  Marcar as {sug.length} disciplina(s) com aula no período
                </Button>
              );
            })()}
            {ehAC && <ItensAtividadeComplementar itens={itens} onChange={setItens} categorias={categorias} anexoDef={tipo.anexos.find((a) => a.id === 'certificado')} />}
            {atrasado && (
              <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Passou o prazo de {prazo!.dias_uteis} dias úteis. Você pode protocolar; a coordenação decide se aceita.
              </p>
            )}
            {errosCampos.length > 0 && <ul className="list-disc pl-4 text-xs text-muted-foreground">{errosCampos.map((e) => <li key={e}>{e}</li>)}</ul>}
            <div className="flex justify-between border-t border-border pt-4">
              {voltarBtn(1, 'Tipo')}
              <Button className="rounded-md" disabled={errosCampos.length > 0} onClick={() => setPasso(ehAC ? 4 : 3)}>Continuar</Button>
            </div>
          </div>
        </Secao>
      )}

      {tipo && passo === 3 && (
        <Secao titulo="Anexos" acao={<span className="text-xs text-muted-foreground">PDF ou foto legível, até 10 MB</span>}>
          <div className="space-y-5">
            <AnexosUploader defs={tipo.anexos} arquivos={arquivos} onChange={(id, f) => setArquivos((a) => ({ ...a, [id]: f }))} />
            {errosAnexos.length > 0 && <ul className="list-disc pl-4 text-xs text-muted-foreground">{errosAnexos.map((e) => <li key={e}>{e}</li>)}</ul>}
            <div className="flex justify-between border-t border-border pt-4">
              {voltarBtn(2, 'Dados')}
              <Button className="rounded-md" disabled={errosAnexos.length > 0} onClick={() => setPasso(4)}>Revisar</Button>
            </div>
          </div>
        </Secao>
      )}

      {tipo && passo === 4 && (
        <Secao titulo={`Revisão — ${tipo.nome}`}>
          <div className="space-y-5">
            <DadosProtocolo tipo={tipo} dados={{ ...dadosFinais,
              materia_nome: disciplinas.find((d) => d.materia_id === dados.materia_id)?.nome,
              professor_nome: professores.find((p) => p.id === dados.professor_id)?.nome ?? disciplinas.find((d) => d.professor_id === dados.professor_id)?.professor_nome,
              orientador_nome: professores.find((p) => p.id === dados.orientador_id)?.nome,
              disciplinas_nomes: ((dados.disciplinas as string[]) ?? []).map((id) => disciplinas.find((d) => d.materia_id === id)?.nome ?? id),
            }} />
            <div className="text-sm">
              <p className="inst-kicker">Arquivos</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {(ehAC ? itens.map((i) => i.arquivo).filter(Boolean) as File[] : Object.values(arquivos).flat()).map((f, i) => <li key={i} className="break-all">{f.name}</li>)}
              </ul>
            </div>
            {errosAnexos.length > 0 && <ul className="list-disc pl-4 text-xs text-destructive">{errosAnexos.map((e) => <li key={e}>{e}</li>)}</ul>}
            <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
              <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(!!v)} className="mt-0.5" />
              Declaro que as informações são verdadeiras e que os documentos anexados são autênticos.
            </label>
            {progresso !== null && <Progress value={progresso} aria-label="Enviando" />}
            <div className="flex justify-between border-t border-border pt-4">
              {voltarBtn(ehAC ? 2 : 3, 'Voltar')}
              <Button className="rounded-md" disabled={!aceite || progresso !== null || errosAnexos.length > 0 || errosCampos.length > 0} onClick={enviar}>
                {progresso !== null ? 'Enviando…' : 'Protocolar'}
              </Button>
            </div>
          </div>
        </Secao>
      )}
      <p className="mt-6 text-sm"><Link to="/central/protocolos" className="inst-link">Voltar aos meus protocolos</Link></p>
    </CentralLayout>
  );
}
