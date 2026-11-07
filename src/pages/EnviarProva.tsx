import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  FileText, Upload, CheckCircle2, XCircle, Loader2, Settings,
  CalendarClock, AlertTriangle, Sparkles, RotateCcw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/ThemeToggle';
import PageBackground from '@/components/PageBackground';
import ProfessorCombobox from '@/components/bater-ponto/ProfessorCombobox';
import { supabase } from '@/integrations/supabase/client';
import { legacyExamClient } from '@/lib/legacyExamClient';
import { toast } from '@/hooks/use-toast';
import { todayLocalISO } from '@/lib/datetime';
import { getAppSettings, isProvasAtivo, type AppSettings, DEFAULT_SETTINGS } from '@/lib/appSettings';
import type { Professor, Materia, Turma } from '@/lib/types';
import logoFemaf from '@/assets/logo-femaf.png';

// Nomes de prova fixos, alinhados ao calendário acadêmico da FEMAF — o
// professor escolhe entre eles em vez de digitar livremente, evitando
// títulos inconsistentes ("AV1", "Av. 1", "avaliação um"...) nos registros.
const TITULOS_PROVA = [
  { value: 'VP1', label: 'VP1 — 1ª Avaliação' },
  { value: 'VP2', label: 'VP2 — 2ª Avaliação' },
  { value: 'VP3', label: 'VP3 — 3ª Avaliação' },
  { value: 'Segunda Chamada', label: 'Prova de Segunda Chamada' },
  { value: 'Prova Final', label: 'Prova Final' },
] as const;

interface ChecklistItem { id: string; label: string; ok: boolean; mensagem: string }
interface ProvaEnviada {
  id: string; titulo: string; materia_nome: string; turma_nome: string;
  data_prova: string; status: string; created_at: string; gerada: boolean;
}

export default function EnviarProva() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [professores, setProfessores] = useState<Professor[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [profMaterias, setProfMaterias] = useState<{ professor_id: string; materia_id: string }[]>([]);
  const [turmaMaterias, setTurmaMaterias] = useState<{ turma_id: string; materia_id: string }[]>([]);

  const [professorId, setProfessorId] = useState('');
  const [pin, setPin] = useState('');
  const [titulo, setTitulo] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [dataProva, setDataProva] = useState(todayLocalISO());

  const [file, setFile] = useState<File | null>(null);
  const [arquivoPath, setArquivoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validando, setValidando] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[] | null>(null);
  const [erroChecklist, setErroChecklist] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const [minhasProvas, setMinhasProvas] = useState<ProvaEnviada[] | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then((s) => setSettings(s))
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
    (async () => {
      const [{ data: p }, { data: m }, { data: t }, { data: pm }, { data: tm }] = await Promise.all([
        supabase.from('professores').select('*').eq('status', 'ativo').order('nome'),
        supabase.from('materias').select('*').order('nome'),
        supabase.from('turmas').select('*').order('nome'),
        supabase.from('professor_materias').select('professor_id, materia_id'),
        supabase.from('turma_materias').select('turma_id, materia_id'),
      ]);
      setProfessores((p || []) as any);
      setMaterias((m || []) as any);
      setTurmas((t || []) as any);
      setProfMaterias(pm || []);
      setTurmaMaterias(tm || []);
    })();
  }, []);

  const ativo = isProvasAtivo(settings.provas);

  const materiasDisponiveis = professorId
    ? materias.filter((m) => profMaterias.some((pm) => pm.professor_id === professorId && pm.materia_id === m.id))
    : [];
  const turmasDisponiveis = materiaId
    ? turmas.filter((t) => turmaMaterias.some((tm) => tm.turma_id === t.id && tm.materia_id === materiaId))
    : [];

  function resetArquivo() {
    setFile(null);
    setArquivoPath(null);
    setChecklist(null);
    setErroChecklist(null);
  }

  async function handleFileChange(f: File | null) {
    resetArquivo();
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: 'Formato inválido', description: 'Envie a prova em PDF.', variant: 'destructive' });
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Tamanho máximo: 25MB.', variant: 'destructive' });
      return;
    }
    if (!professorId) {
      toast({ title: 'Selecione o professor primeiro', variant: 'destructive' });
      return;
    }
    setFile(f);
    setUploading(true);
    try {
      const path = `${professorId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('provas-envios').upload(path, f, { contentType: 'application/pdf' });
      if (upErr) throw new Error(upErr.message);
      setArquivoPath(path);
      setUploading(false);
      setValidando(true);
      const { data, error } = await supabase.functions.invoke('prova-checklist', { body: { arquivo_path: path } });
      setValidando(false);
      if (error) throw error;
      setChecklist(data.itens || []);
      if (!data.ok) setErroChecklist(data.primeiroErro || 'A prova não segue o modelo padrão.');
    } catch (e: any) {
      setUploading(false);
      setValidando(false);
      toast({ title: 'Falha ao processar o arquivo', description: e.message, variant: 'destructive' });
      resetArquivo();
    }
  }

  async function handleSubmit() {
    if (!professorId || !pin || !titulo.trim() || !materiaId || !turmaId || !dataProva) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    if (!arquivoPath) {
      toast({ title: 'Envie o arquivo da prova em PDF', variant: 'destructive' });
      return;
    }
    if (checklist && checklist.some((c) => !c.ok)) {
      toast({ title: 'Corrija o arquivo', description: 'A prova não atende ao modelo padrão. Corrija e reenvie.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('prova-enviar', {
        body: { professor_id: professorId, pin, titulo: titulo.trim(), materia_id: materiaId, turma_id: turmaId, data_prova: dataProva, arquivo_path: arquivoPath },
      });
      if (error) {
        const ctx = (error as any).context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error || error.message);
      }
      if (data?.ok === false) {
        setChecklist(data.checklist || null);
        setErroChecklist(data.error);
        throw new Error(data.error);
      }
      confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
      setSucesso(true);
      toast({ title: 'Prova enviada com sucesso!', description: 'Ela já está disponível para a coordenação gerar as cópias.' });
    } catch (e: any) {
      toast({ title: 'Não foi possível enviar a prova', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  function novoEnvio() {
    setSucesso(false);
    setTitulo('');
    setMateriaId('');
    setTurmaId('');
    setPin('');
    resetArquivo();
  }

  async function carregarMinhasProvas() {
    if (!professorId || !pin) {
      toast({ title: 'Digite o PIN para ver seus envios', variant: 'destructive' });
      return;
    }
    setCarregandoLista(true);
    const { data, error } = await legacyExamClient.rpc('prova_listar_professor', { p_prof_id: professorId, p_pin: pin });
    setCarregandoLista(false);
    if (error) {
      toast({ title: 'Não foi possível carregar', description: error.message, variant: 'destructive' });
      return;
    }
    setMinhasProvas((data || []) as any);
  }

  const statusBadge = useMemo(() => ({
    aprovada: { label: 'Aprovada', className: 'bg-success/15 text-success border-success/30' },
    rejeitada: { label: 'Rejeitada', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    cancelada: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
  } as Record<string, { label: string; className: string }>), []);

  return (
    <div className="min-h-screen relative">
      <PageBackground />
      <header className="sticky top-0 z-50 gradient-primary shadow-lg">
        <div className="container flex items-center justify-between gap-2 h-16 px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <img src={logoFemaf} alt="FEMAF" className="h-9 sm:h-10 shrink-0 rounded-xl bg-primary-foreground p-1 shadow-md" />
            <div className="hidden sm:block min-w-0">
              <p className="text-primary-foreground font-bold text-sm leading-tight truncate">Envio de Provas</p>
              <p className="text-primary-foreground/60 text-xs truncate">FEMAF</p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <ThemeToggle />
            <Link to="/" className="text-primary-foreground/70 hover:text-primary-foreground px-2 py-2 rounded-lg hover:bg-primary-foreground/10 transition-colors text-[11px] font-semibold">
              BATER PONTO
            </Link>
            <Link to="/login" className="text-primary-foreground/70 hover:text-primary-foreground p-1.5 sm:p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors">
              <Settings size={18} />
            </Link>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 lg:py-10">
        <div className="max-w-lg w-full mx-auto space-y-4">
            {loadingSettings ? (
              <Card className="premium-card"><CardContent className="p-8 text-center text-muted-foreground">Carregando...</CardContent></Card>
            ) : !ativo ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="premium-card border-warning/40">
                  <CardContent className="p-8 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto">
                      <CalendarClock size={26} className="text-warning" />
                    </div>
                    <h2 className="font-display text-xl font-bold">Período de envio fechado</h2>
                    <p className="text-sm text-muted-foreground">
                      O envio de provas para impressão está disponível apenas dentro do período configurado pela coordenação.
                      {settings.provas?.data_inicio && settings.provas?.data_fim && (
                        <> Próxima janela: <strong>{settings.provas.data_inicio.split('-').reverse().join('/')}</strong> a <strong>{settings.provas.data_fim.split('-').reverse().join('/')}</strong>.</>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : sucesso ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="premium-card border-success/40">
                  <CardContent className="p-8 text-center space-y-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}
                      className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={32} className="text-success" />
                    </motion.div>
                    <h2 className="font-display text-xl font-bold">Prova enviada!</h2>
                    <p className="text-sm text-muted-foreground">Sua prova foi aprovada no checklist e está disponível para a coordenação gerar as cópias personalizadas.</p>
                    <Button onClick={novoEnvio} variant="outline" className="gap-2 w-full"><RotateCcw size={15} /> Enviar outra prova</Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <Card className="premium-card">
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={20} className="text-secondary" />
                      <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">Enviar prova para impressão</h1>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Professor *</Label>
                      <ProfessorCombobox
                        professores={professores}
                        value={professorId}
                        onChange={(v) => { setProfessorId(v); setMateriaId(''); setTurmaId(''); resetArquivo(); setMinhasProvas(null); }}
                        ariaLabel="Buscar professor"
                        placeholder="Digite as primeiras letras do nome..."
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prova *</Label>
                      <Select value={titulo} onValueChange={setTitulo}>
                        <SelectTrigger className="input-premium"><SelectValue placeholder="Selecione a prova" /></SelectTrigger>
                        <SelectContent>
                          {TITULOS_PROVA.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Disciplina *</Label>
                        <Select value={materiaId} onValueChange={(v) => { setMateriaId(v); setTurmaId(''); }} disabled={!professorId}>
                          <SelectTrigger><SelectValue placeholder={professorId ? 'Selecione' : 'Escolha o professor'} /></SelectTrigger>
                          <SelectContent>{materiasDisponiveis.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Turma *</Label>
                        <Select value={turmaId} onValueChange={setTurmaId} disabled={!materiaId}>
                          <SelectTrigger><SelectValue placeholder={materiaId ? 'Selecione' : 'Escolha a disciplina'} /></SelectTrigger>
                          <SelectContent>{turmasDisponiveis.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data da prova *</Label>
                      <Input type="date" value={dataProva} onChange={(e) => setDataProva(e.target.value)} className="input-premium" />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arquivo da prova (PDF, modelo padrão) *</Label>
                      <label className={`mt-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                        file ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-primary/5'
                      }`}>
                        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
                        {uploading || validando ? (
                          <><Loader2 size={22} className="animate-spin text-primary" /><span className="text-xs text-muted-foreground">{uploading ? 'Enviando arquivo...' : 'Validando modelo...'}</span></>
                        ) : file ? (
                          <><FileText size={22} className="text-primary" /><span className="text-xs font-medium truncate max-w-full">{file.name}</span></>
                        ) : (
                          <><Upload size={22} className="text-muted-foreground" /><span className="text-xs text-muted-foreground">Toque para selecionar o PDF (máx. 25MB)</span></>
                        )}
                      </label>
                    </div>

                    <AnimatePresence>
                      {checklist && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className={`rounded-xl border p-3 space-y-1.5 ${erroChecklist ? 'border-destructive/40 bg-destructive/5' : 'border-success/40 bg-success/5'}`}>
                          <p className="text-xs font-semibold flex items-center gap-1.5">
                            {erroChecklist ? <AlertTriangle size={13} className="text-destructive" /> : <CheckCircle2 size={13} className="text-success" />}
                            {erroChecklist ? 'A prova não segue o modelo padrão' : 'Prova conforme o modelo padrão'}
                          </p>
                          <ul className="space-y-1">
                            {checklist.map((c) => (
                              <li key={c.id} className="flex items-start gap-1.5 text-[11px]">
                                {c.ok ? <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" /> : <XCircle size={12} className="text-destructive mt-0.5 shrink-0" />}
                                <span className={c.ok ? 'text-muted-foreground' : 'text-destructive font-medium'}>{c.label}{!c.ok && `: ${c.mensagem}`}</span>
                              </li>
                            ))}
                          </ul>
                          {erroChecklist && <p className="text-[11px] text-destructive pt-1">Corrija o arquivo e envie novamente.</p>}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PIN *</Label>
                      <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" className="input-premium" />
                    </div>

                    <Button onClick={handleSubmit} disabled={submitting || uploading || validando || !!erroChecklist} className="btn-premium w-full gap-2">
                      {submitting ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : <><Upload size={16} /> Enviar prova</>}
                    </Button>
                  </CardContent>
                </Card>

                {professorId && (
                  <Card className="glass-card-hover">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Minhas provas enviadas</p>
                        <Button variant="ghost" size="sm" onClick={carregarMinhasProvas} disabled={carregandoLista}>
                          {carregandoLista ? <Loader2 size={14} className="animate-spin" /> : 'Ver envios'}
                        </Button>
                      </div>
                      {minhasProvas && (
                        minhasProvas.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhuma prova enviada ainda.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto">
                            {minhasProvas.map((p) => (
                              <div key={p.id} className="flex items-center justify-between text-xs rounded-lg bg-muted/40 px-2.5 py-1.5">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{p.titulo}</p>
                                  <p className="text-muted-foreground truncate">{p.materia_nome} • {p.turma_nome}</p>
                                </div>
                                <Badge variant="outline" className={statusBadge[p.status]?.className}>{statusBadge[p.status]?.label || p.status}</Badge>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
        </div>
      </main>
    </div>
  );
}
