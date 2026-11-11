import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Lock, Settings, WifiOff, UserCog, Briefcase, GraduationCap, CalendarDays, BookOpen, Users2, StickyNote, Wallet, Download } from 'lucide-react';
import PontoAdministrativoPanel from '@/components/bater-ponto/PontoAdministrativoPanel';
import { supabase } from '@/integrations/supabase/client';
import { HORARIOS as HORARIOS_FALLBACK, MINUTOS_POR_HORARIO, isMateriaPratica } from '@/lib/types';
import type { Professor, Materia, Turma } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import logoFemaf from '@/assets/logo-femaf.png';
import confetti from 'canvas-confetti';
import ThemeToggle from '@/components/ThemeToggle';
import GpsStatus from '@/components/bater-ponto/GpsStatus';
import HistoricoList from '@/components/bater-ponto/HistoricoList';
import SuccessScreen from '@/components/bater-ponto/SuccessScreen';
import ProfessorCombobox from '@/components/bater-ponto/ProfessorCombobox';
import PageBackground from '@/components/PageBackground';
import SinoNotificacoes from '@/components/SinoNotificacoes';
import { SectionLabel, InlineNote } from '@/components/bater-ponto/SectionLabel';
import DateField from '@/components/bater-ponto/DateField';
import { useGps } from '@/hooks/useGps';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { todayLocalISO } from '@/lib/datetime';
import { subscribePush } from '@/lib/push';
import { getAppSettings, DEFAULT_SETTINGS, type AppSettings } from '@/lib/appSettings';

type CalEntry = { data: string; tipo: 'feriado'|'recesso'|'sabado_letivo'|'evento'|'prova'|'reposicao'; descricao: string };

/**
 * `somenteProfessor`: versão isolada (rota /ponto) para os professores — só o registro de aula,
 * sem a aba do ponto administrativo e sem atalhos para coordenação, permuta, provas ou área administrativa.
 */
export default function BaterPonto({ somenteProfessor = false }: { somenteProfessor?: boolean } = {}) {
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [allMaterias, setAllMaterias] = useState<Materia[]>([]);
  const [allTurmas, setAllTurmas] = useState<Turma[]>([]);
  const [profMaterias, setProfMaterias] = useState<{ professor_id: string; materia_id: string }[]>([]);
  const [turmaMaterias, setTurmaMaterias] = useState<{ turma_id: string; materia_id: string }[]>([]);
  const [horariosGrade, setHorariosGrade] = useState<
    { professor_id: string; materia_id: string; turma_id: string; dia_semana: number; horario_id: number }[]
  >([]);
  const [calendario, setCalendario] = useState<CalEntry[]>([]);

  const [professorId, setProfessorId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [data, setData] = useState(todayLocalISO());
  const [horariosSel, setHorariosSel] = useState<number[]>([]);
  const [observacao, setObservacao] = useState('');
  const [pin, setPin] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historico, setHistorico] = useState<any[]>([]);
  const [modoSubstituicao, setModoSubstituicao] = useState(false);
  const [profSubstituidoId, setProfSubstituidoId] = useState('');
  const [historicoLimite, setHistoricoLimite] = useState(5);
  const [appCfg, setAppCfg] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [modo, setModo] = useState<'professor' | 'administrativo'>('professor');
  useEffect(() => {
    if (!somenteProfessor) return;
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const anterior = link?.getAttribute('href');
    link?.setAttribute('href', '/manifest-ponto.webmanifest');
    const tituloAnterior = document.title;
    document.title = 'Ponto do Professor – FEMAF';
    return () => { if (link && anterior) link.setAttribute('href', anterior); document.title = tituloAnterior; };
  }, [somenteProfessor]);
  const [funcsAdm, setFuncsAdm] = useState<{ id: string; nome_completo: string; tipo_funcionario: string; funcao_nome: string | null; escala_id: string | null }[]>([]);
  const [funcAdmId, setFuncAdmId] = useState('');
  useEffect(() => { getAppSettings().then(setAppCfg).catch(() => {}); }, []);
  useEffect(() => {
    supabase.rpc('list_funcionarios_admin_ativos').then(({ data }) => setFuncsAdm((data as any) || []));
  }, []);
  const HORARIOS = appCfg.horarios?.length ? appCfg.horarios : HORARIOS_FALLBACK;
  const FEMAF_LAT = appCfg.geofence.lat;
  const FEMAF_LNG = appCfg.geofence.lng;
  const RAIO_PERMITIDO_METROS = appCfg.geofence.raio_m;

  const gps = useGps(FEMAF_LAT, FEMAF_LNG, RAIO_PERMITIDO_METROS);
  const online = useOnlineStatus();

  const today = todayLocalISO();
  const isFuture = data > today;
  const isRetroativo = data < today;

  useEffect(() => {
    loadData();
  }, []);

  // O histórico exige o PIN na função protegida. Debounce evita gastar tentativas de PIN a
  // cada tecla digitada — só busca depois de meio segundo sem digitar.
  useEffect(() => {
    if (!professorId || pin.length < 4) {
      setHistorico([]);
      return;
    }
    const t = setTimeout(() => loadHistorico(), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professorId, pin, historicoLimite]);

  // Limpa horários selecionados quando muda data/prof/matéria/turma/substituído
  useEffect(() => {
    setHorariosSel([]);
  }, [data, professorId, materiaId, turmaId, profSubstituidoId, modoSubstituicao]);

  async function loadData() {
    const [{ data: profs }, { data: mats }, { data: turmas }, { data: pm }, { data: tm }, { data: ha }, { data: cal }] =
      await Promise.all([
        supabase.rpc('list_professores_ativos'),
        supabase.from('materias').select('*'),
        supabase.from('turmas').select('*'),
        supabase.from('professor_materias').select('professor_id, materia_id'),
        supabase.from('turma_materias').select('turma_id, materia_id'),
        supabase.from('horarios_aula').select('professor_id, materia_id, turma_id, dia_semana, horario_id'),
        supabase.from('calendario_academico').select('data, tipo, descricao'),
      ]);
    setProfessores((profs || []) as any);
    setAllMaterias((mats || []) as any);
    setAllTurmas((turmas || []) as any);
    setProfMaterias(pm || []);
    setTurmaMaterias(tm || []);
    setHorariosGrade((ha || []) as any);
    setCalendario((cal || []) as any);
  }

  async function loadHistorico() {
    const { data, error } = await supabase.rpc('get_historico_professor_seguro', {
      p_prof_id: professorId,
      p_pin: pin,
      p_limite: historicoLimite,
    });
    if (error) {
      setHistorico([]);
      if (pin.length >= 4) toast({ title: 'Não foi possível carregar o histórico', description: error.message, variant: 'destructive' });
      return;
    }
    setHistorico(data || []);
  }

  const prof = professores.find((p) => p.id === professorId);
  // Em substituição, as matérias/turmas vêm da grade do professor SUBSTITUÍDO
  const profGradeId = modoSubstituicao ? profSubstituidoId : professorId;
  const materiasDisponiveis = profGradeId
    ? allMaterias.filter((m) =>
        profMaterias.some((pm) => pm.professor_id === profGradeId && pm.materia_id === m.id),
      )
    : [];
  const turmasDisponiveis = materiaId
    ? allTurmas.filter((t) =>
        turmaMaterias.some((tm) => tm.turma_id === t.id && tm.materia_id === materiaId),
      )
    : [];

  const diaSemana = (() => {
    const [y, m, d] = data.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })();

  const calEntry = calendario.find((c) => c.data === data);
  const isFeriadoOuRecesso = !!calEntry && (calEntry.tipo === 'feriado' || calEntry.tipo === 'recesso');
  const sabadoNaoLetivo = diaSemana === 6 && !calEntry;
  const domingo = diaSemana === 0 && !calEntry;
  const diaBloqueado = isFeriadoOuRecesso || sabadoNaoLetivo || domingo;
  const motivoBloqueio = isFeriadoOuRecesso
    ? `${calEntry!.descricao} (${calEntry!.tipo === 'feriado' ? 'feriado' : 'recesso'})`
    : domingo
      ? 'Domingo não é dia letivo'
      : sabadoNaoLetivo
        ? 'Sábado não letivo (sem reposição/sábado letivo no calendário)'
        : null;
  const horariosPermitidos = new Set(
    profGradeId && materiaId && turmaId
      ? horariosGrade
          .filter(
            (g) =>
              g.professor_id === profGradeId &&
              g.materia_id === materiaId &&
              g.turma_id === turmaId &&
              g.dia_semana === diaSemana,
          )
          .map((g) => g.horario_id)
      : [],
  );
  const semAulaNoDia = !!(profGradeId && materiaId && turmaId) && horariosPermitidos.size === 0;

  const qtdHorarios = horariosSel.length;
  const cargaHoraria = qtdHorarios * MINUTOS_POR_HORARIO;
  const valorTotal = prof ? qtdHorarios * Number(prof.valor_hora_aula) : 0;

  function toggleHorario(id: number) {
    if (!horariosPermitidos.has(id)) {
      toast({
        title: 'Horário fora da grade',
        description: 'Esse horário não consta na grade desta disciplina/turma para o dia selecionado.',
        variant: 'destructive',
      });
      return;
    }
    setHorariosSel((prev) => (prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id]));
  }

  function fireConfetti() {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#1E1180', '#0095E8', '#0A78D8'],
    });
  }

  function resetForm() {
    setSaved(false);
    setProfessorId('');
    setMateriaId('');
    setTurmaId('');
    setHorariosSel([]);
    setObservacao('');
    setPin('');
    setJustificativa('');
    setAnexoFile(null);
    setData(todayLocalISO());
    setHistorico([]);
    setModoSubstituicao(false);
    setProfSubstituidoId('');
  }

  async function uploadAnexo(): Promise<string | null> {
    if (!anexoFile) return null;
    const ext = anexoFile.name.split('.').pop() || 'pdf';
    const path = `${professorId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('justificativas')
      .upload(path, anexoFile, { contentType: anexoFile.type || 'application/pdf' });
    if (upErr) throw new Error('Falha ao enviar anexo: ' + upErr.message);
    // Bucket é privado — guardamos só o caminho do objeto; a visualização
    // (admin/coordenação) gera uma URL assinada de curta duração sob demanda.
    return path;
  }

  async function handleRegistrar() {
    if (!online) {
      toast({ title: 'Sem conexão', description: 'Conecte-se à internet para registrar.', variant: 'destructive' });
      return;
    }
    if (gps.status !== 'ok') {
      toast({ title: 'Localização não permitida', description: 'Você precisa estar na faculdade.', variant: 'destructive' });
      return;
    }
    if (isFuture) {
      toast({ title: 'Data inválida', description: 'Não é possível bater ponto em data futura.', variant: 'destructive' });
      return;
    }
    if (diaBloqueado) {
      toast({ title: 'Dia sem aula', description: motivoBloqueio || 'Esta data não é dia letivo.', variant: 'destructive' });
      return;
    }
    if (!professorId || !materiaId || !turmaId || horariosSel.length === 0) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (modoSubstituicao && !profSubstituidoId) {
      toast({ title: 'Selecione o professor a ser substituído', variant: 'destructive' });
      return;
    }
    if (modoSubstituicao && profSubstituidoId === professorId) {
      toast({ title: 'Substituição inválida', description: 'Você não pode substituir a si mesmo.', variant: 'destructive' });
      return;
    }
    if (!pin) {
      toast({ title: 'Digite seu PIN', variant: 'destructive' });
      return;
    }
    if (isRetroativo && justificativa.trim().length < 5) {
      toast({ title: 'Justificativa obrigatória', description: 'Explique por que está batendo ponto retroativo (mín. 5 caracteres).', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let anexoUrl: string | null = null;
      if (isRetroativo && anexoFile) {
        anexoUrl = await uploadAnexo();
      }

      const { data: result, error } = await supabase.functions.invoke('registrar-ponto', {
        body: {
          professor_id: professorId,
          materia_id: materiaId,
          turma_id: turmaId,
          data,
          horarios: horariosSel,
          observacao: observacao || null,
          pin,
          latitude: gps.lat,
          longitude: gps.lng,
          retroativo: isRetroativo,
          justificativa: isRetroativo ? justificativa : null,
          anexo_url: anexoUrl,
          professor_substituido_id: modoSubstituicao ? profSubstituidoId : null,
        },
      });

      if (error || (result && (result as any).error)) {
        let msg = (result as any)?.error || error?.message || 'Falha ao registrar';
        try {
          const ctx: any = (error as any)?.context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          } else if (ctx?.error) {
            msg = ctx.error;
          }
        } catch {}
        toast({ title: 'Erro ao registrar', description: msg, variant: 'destructive' });
        if (/PIN/i.test(msg)) setPin('');
        return;
      }

      const pendente = (result as any)?.status_aprovacao === 'pendente';
      setSaved(true);
      fireConfetti();
      try { (navigator as any).vibrate?.([30, 40, 60]); } catch {}
      toast({
        title: pendente ? '⏳ Solicitação enviada' : '✅ Ponto registrado com sucesso!',
        description: pendente ? 'Aguardando aprovação do administrativo.' : undefined,
      });
      subscribePush({ professor_id: professorId, pin, role: 'professor' }).catch(() => {});
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) {
    return (
      <SuccessScreen
        qtdHorarios={qtdHorarios}
        cargaHoraria={cargaHoraria}
        valorTotal={valorTotal}
        onClose={resetForm}
      />
    );
  }

  return (
    <div className="min-h-screen relative">
      <PageBackground />
      <header className="sticky top-0 z-50 gradient-primary shadow-lg">
        <div className="container flex items-center justify-between gap-2 h-16 px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <motion.img
              src={logoFemaf}
              alt="Logotipo FEMAF"
              className="h-9 sm:h-10 shrink-0 rounded-xl bg-primary-foreground p-1 shadow-md"
              whileHover={{ scale: 1.05 }}
            />
            <div className="hidden sm:block min-w-0">
              <p className="text-primary-foreground font-bold text-sm leading-tight truncate">Ponto Digital</p>
              <p className="text-primary-foreground/60 text-xs truncate">FEMAF</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <ThemeToggle />
            {professorId && (
              <SinoNotificacoes professor_id={professorId} pin={pin} className="text-primary-foreground hover:bg-primary-foreground/10" />
            )}
            {!somenteProfessor && (<>
            <Link
              to="/coordenador/login"
              className="text-primary-foreground/70 hover:text-primary-foreground px-1.5 sm:px-2 py-2 rounded-lg hover:bg-primary-foreground/10 transition-colors text-[10px] sm:text-[11px] font-semibold"
              title="Acesso da Coordenação"
              aria-label="Acesso da Coordenação"
            >
              COORD
            </Link>
            <Link
              to="/permuta"
              className="text-primary-foreground/70 hover:text-primary-foreground px-1.5 sm:px-2 py-2 rounded-lg hover:bg-primary-foreground/10 transition-colors text-[10px] sm:text-[11px] font-semibold"
              title="Permuta de horários"
              aria-label="Permuta de horários"
            >
              PERMUTA
            </Link>
            <Link
              to="/enviar-prova"
              className="text-primary-foreground/70 hover:text-primary-foreground px-1.5 sm:px-2 py-2 rounded-lg hover:bg-primary-foreground/10 transition-colors text-[10px] sm:text-[11px] font-semibold"
              title="Enviar prova para impressão"
              aria-label="Enviar prova para impressão"
            >
              PROVAS
            </Link>
            <Link
              to="/instalar"
              className="text-primary-foreground/70 hover:text-primary-foreground p-1.5 sm:p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors"
              title="Instalar App"
              aria-label="Instalar aplicativo"
            >
              <Download size={18} className="sm:w-5 sm:h-5" aria-hidden />
            </Link>
            <Link
              to="/login"
              className="text-primary-foreground/70 hover:text-primary-foreground p-1.5 sm:p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors"
              title="Área Administrativa"
              aria-label="Área administrativa"
            >
              <Settings size={18} className="sm:w-5 sm:h-5" aria-hidden />
            </Link>
            </>)}
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 lg:py-10">
        <div className="max-w-lg w-full mx-auto space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="icon-badge w-12 h-12 sm:w-14 sm:h-14 rounded-2xl gradient-primary shadow-glow-primary">
              <Clock size={24} className="text-primary-foreground sm:w-7 sm:h-7" aria-hidden />
            </div>
            <div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Bater Ponto</h1>
              <p className="text-muted-foreground text-sm font-medium">{somenteProfessor ? 'Professor · registrar aula' : 'Registrar aula'}</p>
            </div>
          </motion.div>

          {!somenteProfessor && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-muted/40 border border-border/60">
            <button
              type="button"
              onClick={() => { setModo('professor'); setFuncAdmId(''); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-premium ${
                modo === 'professor' ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GraduationCap size={16} aria-hidden /> Professor
            </button>
            <button
              type="button"
              onClick={() => { setModo('administrativo'); setProfessorId(''); }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-premium ${
                modo === 'administrativo' ? 'gradient-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Briefcase size={16} aria-hidden /> Administrativo
            </button>
          </div>
          )}

          {modo === 'administrativo' ? (
            funcAdmId ? (
              <PontoAdministrativoPanel
                funcionario={funcsAdm.find(f => f.id === funcAdmId)!}
                onTrocarPessoa={() => setFuncAdmId('')}
                gpsStatus={gps.status}
                gpsLat={gps.lat}
                gpsLng={gps.lng}
                gpsDistancia={gps.distancia}
                gpsRaio={RAIO_PERMITIDO_METROS}
                onRetryGps={gps.refresh}
              />
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="premium-card">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-md shrink-0">
                        <Briefcase size={20} className="text-primary-foreground" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground leading-tight">Ponto administrativo</p>
                        <p className="text-xs text-muted-foreground">Identifique-se para continuar</p>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Funcionário
                      </Label>
                      <Select value={funcAdmId} onValueChange={setFuncAdmId}>
                        <SelectTrigger className="mt-1.5 h-12"><SelectValue placeholder="Selecione seu nome..." /></SelectTrigger>
                        <SelectContent>
                          {funcsAdm.map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome_completo} {f.funcao_nome ? `— ${f.funcao_nome}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {funcsAdm.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">Nenhum funcionário administrativo ativo cadastrado.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          ) : (
            <>


          {!online && (
            <InlineNote tone="destructive">
              <span className="inline-flex items-center gap-1.5"><WifiOff size={13} aria-hidden /> Sem conexão com a internet</span>
            </InlineNote>
          )}

          <GpsStatus
            status={gps.status}
            distancia={gps.distancia}
            raioMax={RAIO_PERMITIDO_METROS}
            onRetry={gps.refresh}
          />

          {gps.status === 'ok' && gps.accuracy !== null && (
            <p className="text-[11px] text-muted-foreground text-center">Precisão GPS: ±{gps.accuracy}m</p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="premium-card">
              <CardContent className="p-5 sm:p-6 space-y-5">
                <div>
                  <SectionLabel icon={CalendarDays}>Data</SectionLabel>
                  <DateField value={data} onChange={setData} max={today} />
                  <div className="mt-1.5 space-y-1">
                    {isFuture && <InlineNote tone="destructive">Data futura não permitida.</InlineNote>}
                    {isRetroativo && <InlineNote tone="warning">Data retroativa — preencha a justificativa abaixo.</InlineNote>}
                    {diaBloqueado && (
                      <InlineNote tone="destructive">
                        <strong>Dia sem aula:</strong> {motivoBloqueio}. Bater ponto nesta data está bloqueado.
                      </InlineNote>
                    )}
                    {!diaBloqueado && calEntry && (
                      <InlineNote tone="primary">{calEntry.descricao} ({calEntry.tipo.replace('_', ' ')})</InlineNote>
                    )}
                  </div>
                </div>

                <div className="border-t border-border/60 pt-5">
                  <SectionLabel icon={GraduationCap}>Professor *</SectionLabel>
                  <ProfessorCombobox
                    professores={professores}
                    value={professorId}
                    onChange={(v) => {
                      setProfessorId(v);
                      setMateriaId('');
                      setTurmaId('');
                      if (!modoSubstituicao) setProfSubstituidoId('');
                    }}
                    ariaLabel="Buscar professor"
                    placeholder="Digite as primeiras letras do nome..."
                  />
                </div>

                {professorId && (
                  <div className="border-t border-border/60 pt-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserCog size={17} className="text-muted-foreground shrink-0" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">Estou substituindo outro professor</p>
                          <p className="text-[11px] text-muted-foreground">
                            {modoSubstituicao ? 'Aprovação passa pelo administrativo' : 'Ative se necessário'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={modoSubstituicao}
                        onCheckedChange={(v) => {
                          setModoSubstituicao(v);
                          setMateriaId('');
                          setTurmaId('');
                          setProfSubstituidoId('');
                        }}
                        aria-label="Ativar modo substituição"
                        className="shrink-0"
                      />
                    </div>
                    <AnimatePresence>
                      {modoSubstituicao && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 space-y-2"
                        >
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Professor substituído *
                          </Label>
                          <ProfessorCombobox
                            professores={professores}
                            value={profSubstituidoId}
                            onChange={(v) => { setProfSubstituidoId(v); setMateriaId(''); setTurmaId(''); }}
                            excludeId={professorId}
                            ariaLabel="Buscar professor substituído"
                            placeholder="Quem você está substituindo?"
                          />
                          <InlineNote tone="warning">A matéria/turma/horários abaixo virão da grade do professor substituído.</InlineNote>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <AnimatePresence>
                  {profGradeId && (!modoSubstituicao || profSubstituidoId) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-border/60 pt-5"
                    >
                      <SectionLabel icon={BookOpen}>Matéria *</SectionLabel>
                      <Select
                        value={materiaId}
                        onValueChange={(v) => {
                          setMateriaId(v);
                          setTurmaId('');
                        }}
                      >
                        <SelectTrigger className="h-11" aria-label="Selecionar matéria">
                          <SelectValue placeholder="Selecione a matéria" />
                        </SelectTrigger>
                        <SelectContent>
                          {materiasDisponiveis.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {materiasDisponiveis.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1.5">Nenhuma matéria vinculada</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {materiaId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-border/60 pt-5"
                    >
                      <SectionLabel icon={Users2}>Turma *</SectionLabel>
                      <Select value={turmaId} onValueChange={setTurmaId}>
                        <SelectTrigger className="h-11" aria-label="Selecionar turma">
                          <SelectValue placeholder="Selecione a turma" />
                        </SelectTrigger>
                        <SelectContent>
                          {turmasDisponiveis.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="border-t border-border/60 pt-5">
                  <SectionLabel icon={Clock}>Horários *</SectionLabel>
                  {(() => {
                    const materiaSelecionada = allMaterias.find((m) => m.id === materiaId);
                    const turmaSelecionada = allTurmas.find((t) => t.id === turmaId);
                    const turnosDaGrade = new Set(
                      HORARIOS.filter((h) => horariosPermitidos.has(h.id)).map((h) => h.turno),
                    );
                    const turnoConfigurado = materiaSelecionada?.turno || turmaSelecionada?.turno?.toLowerCase();
                    const turnoAtivo = turnosDaGrade.size === 1
                      ? Array.from(turnosDaGrade)[0]
                      : turnoConfigurado || (isMateriaPratica(materiaSelecionada?.nome) ? 'vespertino' : 'noturno');
                    const horariosVisiveis = turnosDaGrade.size > 1
                      ? HORARIOS.filter((h) => horariosPermitidos.has(h.id))
                      : HORARIOS.filter((h) => h.turno === turnoAtivo);
                    return (
                      <>
                        {materiaId && (
                          <p className="text-[11px] text-muted-foreground mb-2">
                            Turno: <span className="font-semibold">{turnoAtivo === 'vespertino' ? 'Vespertino (14h–18h)' : 'Noturno (18h30–22h)'}</span>
                          </p>
                        )}
                        {semAulaNoDia && (
                          <InlineNote tone="destructive">Não há aula prevista na grade para este dia.</InlineNote>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-2" role="group" aria-label="Selecionar horários">
                          {horariosVisiveis.map((h) => {
                            const selected = horariosSel.includes(h.id);
                            const allowed = horariosPermitidos.has(h.id);
                            return (
                              <motion.button
                                type="button"
                                key={h.id}
                                whileTap={{ scale: allowed ? 0.96 : 1 }}
                                onClick={() => toggleHorario(h.id)}
                                disabled={!allowed}
                                aria-pressed={selected}
                                aria-label={`${h.label} de ${h.inicio} a ${h.fim}`}
                                className={`p-3 rounded-xl border transition-all text-center ${
                                  !allowed
                                    ? 'border-border/40 bg-muted/30 opacity-40 cursor-not-allowed'
                                    : selected
                                    ? 'border-primary bg-primary/8 shadow-sm cursor-pointer'
                                    : 'border-border hover:border-primary/40 cursor-pointer'
                                }`}
                              >
                                <p className="font-semibold text-sm">{h.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {h.inicio} - {h.fim}
                                </p>
                              </motion.button>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>

                <AnimatePresence>
                  {isRetroativo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-border/60 pt-5 space-y-4"
                    >
                      <div>
                        <SectionLabel icon={StickyNote}>Justificativa do ponto retroativo *</SectionLabel>
                        <Textarea
                          id="just"
                          value={justificativa}
                          onChange={(e) => setJustificativa(e.target.value)}
                          placeholder="Explique o motivo (ex: atestado médico, problema técnico...)"
                          maxLength={1000}
                        />
                      </div>
                      <div>
                        <Label htmlFor="anexo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Anexar PDF (opcional — atestado, declaração)
                        </Label>
                        <Input
                          id="anexo"
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={(e) => setAnexoFile(e.target.files?.[0] || null)}
                          className="mt-1.5"
                        />
                        {anexoFile && (
                          <p className="text-xs text-muted-foreground mt-1.5">Anexado: {anexoFile.name}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="border-t border-border/60 pt-5">
                  <SectionLabel icon={StickyNote}>Observação</SectionLabel>
                  <Textarea
                    id="obs"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Opcional..."
                    maxLength={500}
                  />
                </div>

                <AnimatePresence>
                  {qtdHorarios > 0 && prof && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl bg-muted/40 p-4 space-y-1.5"
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Horários</span>
                        <span className="font-semibold">{qtdHorarios}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Carga</span>
                        <span className="font-semibold">
                          {(cargaHoraria / 60).toFixed(1)}h ({cargaHoraria} min)
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1.5 mt-1.5 border-t border-border/60">
                        <span className="font-semibold text-foreground flex items-center gap-1.5"><Wallet size={14} /> Valor total</span>
                        <span className="font-bold text-primary text-xl">R$ {valorTotal.toFixed(2)}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="border-t border-border/60 pt-5">
                  <SectionLabel icon={Lock}>PIN do Professor *</SectionLabel>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    maxLength={6}
                    className="input-premium text-center text-lg tracking-[0.3em] h-12"
                  />
                </div>

                <motion.div whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }}>
                  <Button
                    onClick={handleRegistrar}
                    className="w-full h-12 text-base font-semibold gap-2 btn-glow btn-premium"
                    size="lg"
                    disabled={submitting || gps.status !== 'ok' || !online}
                    aria-label="Registrar ponto"
                  >
                    <Clock size={20} aria-hidden />
                    {submitting
                      ? 'Registrando...'
                      : !online
                      ? 'Sem conexão'
                      : gps.status !== 'ok'
                      ? 'GPS necessário'
                      : 'Registrar Ponto'}
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {professorId && (
            <>
              <HistoricoList registros={historico} />
              {historico.length >= historicoLimite && historicoLimite < 50 && (
                <button
                  type="button"
                  onClick={() => setHistoricoLimite((n) => Math.min(n + 10, 50))}
                  className="w-full py-2 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
                >
                  Ver mais registros
                </button>
              )}
            </>
          )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
