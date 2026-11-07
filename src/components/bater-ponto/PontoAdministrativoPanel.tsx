import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Briefcase, Clock, Lock, LogIn, LogOut, Coffee, ArrowRightCircle, History, ChevronLeft, StickyNote, CalendarClock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import GpsStatus, { type GpsState } from '@/components/bater-ponto/GpsStatus';
import { SectionLabel, InlineNote } from '@/components/bater-ponto/SectionLabel';
import DateField from '@/components/bater-ponto/DateField';

type Funcionario = {
  id: string;
  nome_completo: string;
  tipo_funcionario: string;
  funcao_nome: string | null;
  escala_id: string | null;
};

type Escala = {
  id: string;
  nome: string;
  dias_semana: number[];
  entrada_prevista: string | null;
  saida_intervalo_prevista: string | null;
  retorno_intervalo_previsto: string | null;
  saida_prevista: string | null;
  intervalo_minutos: number;
};

type Marcacao = {
  id: string;
  data: string;
  tipo_marcacao: string;
  horario_previsto: string | null;
  horario_real: string;
  diferenca_minutos: number | null;
  status: string | null;
  justificativa: string | null;
};

const TIPOS = [
  { key: 'entrada_expediente', label: 'Entrada', icon: LogIn, color: 'from-blue-600 to-blue-500' },
  { key: 'saida_intervalo', label: 'Saída p/ Intervalo', icon: Coffee, color: 'from-sky-600 to-sky-500' },
  { key: 'retorno_intervalo', label: 'Retorno do Intervalo', icon: ArrowRightCircle, color: 'from-cyan-600 to-cyan-500' },
  { key: 'saida_expediente', label: 'Encerrar Expediente', icon: LogOut, color: 'from-indigo-600 to-indigo-500' },
] as const;

interface Props {
  funcionario: Funcionario;
  onTrocarPessoa: () => void;
  gpsStatus: GpsState;
  gpsLat: number | null;
  gpsLng: number | null;
  gpsDistancia: number | null;
  gpsRaio: number;
  onRetryGps: () => void;
}

export default function PontoAdministrativoPanel({
  funcionario, onTrocarPessoa, gpsStatus, gpsLat, gpsLng, gpsDistancia, gpsRaio, onRetryGps,
}: Props) {
  const [escala, setEscala] = useState<Escala | null>(null);
  const [tipo, setTipo] = useState<string>('');
  const [pin, setPin] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [precisaJust, setPrecisaJust] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hist, setHist] = useState<Marcacao[]>([]);
  const [now, setNow] = useState(new Date());
  const [retroativo, setRetroativo] = useState(false);
  const [dataRetro, setDataRetro] = useState('');
  const [horaRetro, setHoraRetro] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!funcionario.escala_id) { setEscala(null); return; }
    supabase.rpc('escala_admin_detalhe', { p_escala_id: funcionario.escala_id })
      .then(({ data }) => setEscala((data as any)?.[0] ?? null));
  }, [funcionario.escala_id]);

  async function carregarHistorico(currentPin: string) {
    if (!currentPin) return;
    const { data, error } = await supabase.rpc('historico_ponto_admin', {
      p_func_id: funcionario.id, p_pin: currentPin, p_limite: 10,
    });
    if (!error) setHist((data as any) || []);
  }

  function previstoDoTipo(t: string): string | null {
    if (!escala) return null;
    switch (t) {
      case 'entrada_expediente': return escala.entrada_prevista;
      case 'saida_intervalo': return escala.saida_intervalo_prevista;
      case 'retorno_intervalo': return escala.retorno_intervalo_previsto;
      case 'saida_expediente': return escala.saida_prevista;
    }
    return null;
  }

  function calcDiff(t: string): number | null {
    const prev = previstoDoTipo(t);
    if (!prev) return null;
    const [h, m] = prev.split(':').map(Number);
    const previstoMin = h * 60 + m;
    const realMin = now.getHours() * 60 + now.getMinutes();
    return realMin - previstoMin;
  }

  useEffect(() => {
    if (!tipo || retroativo) { setPrecisaJust(retroativo); return; }
    const d = calcDiff(tipo);
    if (d === null) { setPrecisaJust(false); return; }
    const atraso = (tipo === 'entrada_expediente' || tipo === 'retorno_intervalo') && d >= 30;
    const antec = (tipo === 'saida_expediente' || tipo === 'saida_intervalo') && d <= -30;
    setPrecisaJust(atraso || antec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, escala, now, retroativo]);

  async function registrar() {
    if (!tipo) { toast({ title: 'Selecione a ação', variant: 'destructive' }); return; }
    if (!pin) { toast({ title: 'Digite seu PIN', variant: 'destructive' }); return; }
    if (precisaJust && justificativa.trim().length < (retroativo ? 5 : 3)) {
      toast({ title: 'Justificativa obrigatória', description: retroativo
        ? 'Ponto retroativo exige justificativa de pelo menos 5 caracteres.'
        : 'Atraso ou saída antecipada ≥ 30 min exige justificativa.', variant: 'destructive' });
      return;
    }

    if (retroativo) {
      if (!dataRetro || !horaRetro) {
        toast({ title: 'Informe data e hora do retroativo', variant: 'destructive' });
        return;
      }
      setSubmitting(true);
      const { error } = await supabase.rpc('bater_ponto_admin_retroativo', {
        p_func_id: funcionario.id, p_pin: pin, p_data: dataRetro,
        p_tipo: tipo, p_hora: horaRetro, p_justificativa: justificativa,
        p_lat: gpsLat, p_lng: gpsLng,
      });
      setSubmitting(false);
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: '⏳ Solicitação enviada', description: 'Aguardando aprovação do administrativo.' });
      setTipo(''); setJustificativa(''); setRetroativo(false); setDataRetro(''); setHoraRetro('');
      carregarHistorico(pin);
      return;
    }

    // Ponto normal — exige GPS validado
    if (gpsStatus !== 'ok') {
      toast({ title: 'Localização não permitida', description: 'Você precisa estar na faculdade.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc('bater_ponto_admin', {
      p_func_id: funcionario.id, p_pin: pin, p_tipo: tipo,
      p_justificativa: precisaJust ? justificativa : null,
      p_lat: gpsLat, p_lng: gpsLng,
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message || '';
      if (msg.includes('JUSTIFICATIVA_OBRIGATORIA')) {
        setPrecisaJust(true);
        toast({ title: 'Justificativa obrigatória', variant: 'destructive' });
      } else if (msg.includes('FORA_DA_AREA')) {
        toast({ title: 'Fora da área permitida', description: msg, variant: 'destructive' });
      } else if (msg.includes('GPS_OBRIGATORIO')) {
        toast({ title: 'GPS obrigatório', variant: 'destructive' });
      } else if (/Credenciais/i.test(msg) || /28000/.test(msg)) {
        toast({ title: 'PIN inválido', variant: 'destructive' });
        setPin('');
      } else {
        toast({ title: 'Erro', description: msg, variant: 'destructive' });
      }
      return;
    }
    const status = (data as any)?.status;
    toast({ title: '✅ Ponto registrado', description: status ? `Status: ${status}` : undefined });
    try { (navigator as any).vibrate?.([30, 40, 60]); } catch {}
    setTipo(''); setJustificativa(''); setPrecisaJust(false);
    carregarHistorico(pin);
  }

  const dataStr = useMemo(() => now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }), [now]);
  const horaStr = useMemo(() => now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), [now]);
  const podeRegistrar = retroativo ? true : gpsStatus === 'ok';

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="premium-card">
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onTrocarPessoa}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Trocar funcionário"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="icon-badge w-12 h-12 rounded-2xl gradient-primary shadow-glow-primary">
                <Briefcase size={22} className="text-primary-foreground" aria-hidden />
              </div>
              <div className="flex-1 min-w-0 basis-0">
                <p className="font-display font-bold text-lg truncate leading-tight tracking-tight">{funcionario.nome_completo}</p>
                <p className="text-xs text-muted-foreground truncate font-medium">{funcionario.funcao_nome || 'Funcionário'}</p>
              </div>
              <p className="font-mono text-xl font-bold tabular-nums leading-none shrink-0">{horaStr}</p>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground border-t border-border/60 pt-4">
              <CalendarClock size={14} className="shrink-0 mt-0.5" aria-hidden />
              <p className="min-w-0">
                <span className="capitalize">{dataStr}</span>
                {escala && (
                  <>
                    {' '}· <span className="font-medium text-foreground">{escala.nome}</span> — Entrada {escala.entrada_prevista?.slice(0,5)} ·
                    {' '}Intervalo {escala.saida_intervalo_prevista?.slice(0,5)}–{escala.retorno_intervalo_previsto?.slice(0,5)} ·
                    {' '}Saída {escala.saida_prevista?.slice(0,5)}
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {!retroativo && (
        <GpsStatus
          status={gpsStatus}
          distancia={gpsDistancia}
          raioMax={gpsRaio}
          onRetry={onRetryGps}
        />
      )}

      <Card className="premium-card">
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel icon={Clock}>Ação *</SectionLabel>
            <div className="flex items-center gap-2 shrink-0">
              <History size={13} className="text-muted-foreground" aria-hidden />
              <Label htmlFor="retro-switch" className="text-xs text-muted-foreground cursor-pointer">Retroativo</Label>
              <Switch
                id="retro-switch"
                checked={retroativo}
                onCheckedChange={(v) => { setRetroativo(v); setTipo(''); setJustificativa(''); }}
                aria-label="Ativar modo retroativo"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map((t) => {
              const Icon = t.icon;
              const ativo = tipo === t.key;
              return (
                <motion.button
                  key={t.key}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setTipo(t.key)}
                  className={`p-3 rounded-xl border text-left transition-all min-w-0 ${
                    ativo
                      ? 'border-primary bg-primary/8 shadow-sm'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <Icon size={18} className={ativo ? 'text-primary' : 'text-muted-foreground'} />
                  <p className="text-xs sm:text-sm font-semibold mt-1 leading-tight">{t.label}</p>
                </motion.button>
              );
            })}
          </div>

          {retroativo && (
            <div className="border-t border-border/60 pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Data *</Label>
                  <div className="mt-1">
                    <DateField value={dataRetro} onChange={setDataRetro} max={new Date().toISOString().slice(0,10)} className="h-10 text-xs" compact />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hora *</Label>
                  <Input type="time" value={horaRetro} onChange={e => setHoraRetro(e.target.value)} className="mt-1" />
                </div>
              </div>
              <InlineNote tone="warning">Pontos retroativos vão para aprovação do administrativo.</InlineNote>
            </div>
          )}

          {precisaJust && (
            <div className="border-t border-border/60 pt-4 space-y-1.5">
              <SectionLabel icon={StickyNote}>Justificativa obrigatória</SectionLabel>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder={retroativo
                  ? 'Explique o motivo do registro retroativo...'
                  : 'Explique o motivo (atraso ou saída antecipada ≥ 30 min)...'}
                maxLength={500}
              />
            </div>
          )}

          <div className="border-t border-border/60 pt-5">
            <SectionLabel icon={Lock}>PIN do Funcionário *</SectionLabel>
            <Input
              id="pin-adm"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onBlur={() => carregarHistorico(pin)}
              placeholder="••••"
              maxLength={6}
              className="input-premium text-center text-lg tracking-[0.3em] h-12"
            />
          </div>

          <motion.div whileTap={{ scale: 0.98 }} whileHover={{ scale: 1.01 }}>
            <Button
              onClick={registrar}
              disabled={submitting || !podeRegistrar}
              className="w-full h-12 text-base font-semibold gap-2 btn-glow btn-premium"
              size="lg"
            >
              <Clock size={20} aria-hidden /> {submitting ? 'Registrando...' : retroativo ? 'Enviar para aprovação' : 'Bater Ponto'}
            </Button>
          </motion.div>
        </CardContent>
      </Card>

      {hist.length > 0 && (
        <Card className="glass-card">
          <CardContent className="p-4 sm:p-5 space-y-2">
            <SectionLabel icon={History}>Últimas marcações</SectionLabel>
            <ul className="divide-y divide-border/60">
              {hist.map((h) => (
                <li key={h.id} className="py-2.5 flex items-center justify-between text-sm gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{TIPOS.find(t => t.key === h.tipo_marcacao)?.label || h.tipo_marcacao}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {new Date(h.horario_real).toLocaleString('pt-BR')}
                      {h.diferenca_minutos != null && ` · ${h.diferenca_minutos > 0 ? '+' : ''}${h.diferenca_minutos} min`}
                    </p>
                  </div>
                  {h.status && (
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md ${
                      h.status === 'no_horario' || h.status === 'tolerancia'
                        ? 'bg-success/15 text-success'
                        : h.status === 'atraso' || h.status === 'saida_antecipada'
                        ? 'bg-warning/15 text-amber-700 dark:text-warning'
                        : h.status === 'pendente'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-primary/10 text-primary'
                    }`}>{h.status}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
