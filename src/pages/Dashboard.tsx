import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, GraduationCap, Clock, FileText, TrendingUp, AlertTriangle, X, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatDateBR, todayLocalISO } from '@/lib/datetime';

const CHART_COLORS = ['hsl(246,60%,35%)', 'hsl(201,80%,55%)', 'hsl(212,85%,55%)', 'hsl(200,70%,50%)', 'hsl(0,72%,51%)', 'hsl(280,60%,50%)'];

// Quinzena atual (1ª se hoje ≤ 15, senão 2ª).
function quinzenaAtual(): { ini: string; fim: string; label: string } {
  const n = new Date();
  const y = n.getFullYear();
  const m = n.getMonth();
  const mm = String(m + 1).padStart(2, '0');
  if (n.getDate() <= 15) {
    return { ini: `${y}-${mm}-01`, fim: `${y}-${mm}-15`, label: '1ª quinzena' };
  }
  const ult = new Date(y, m + 1, 0).getDate();
  return { ini: `${y}-${mm}-16`, fim: `${y}-${mm}-${String(ult).padStart(2, '0')}`, label: '2ª quinzena' };
}

const DISMISS_KEY = 'dashboard_dismiss_sem_ponto_v2';
const TTL_MS = 24 * 60 * 60 * 1000; // 1 dia — renova ao virar dia

function loadDismissed(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') as Record<string, number>;
    const now = Date.now();
    const cleaned: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (now - v < TTL_MS) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length !== Object.keys(raw).length) {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch { return {}; }
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    professores: 0, materias: 0, turmas: 0, registrosHoje: 0,
    totalHorasMes: 0, totalValorMes: 0,
    ultimosRegistros: [] as any[],
    profsMap: {} as Record<string, string>,
    matsMap: {} as Record<string, string>,
    turmasMap: {} as Record<string, string>,
    chartPorProf: [] as { name: string; horas: number; valor: number }[],
    chartPorCurso: [] as { name: string; value: number }[],
    profsSemPonto: [] as string[],
  });
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => loadDismissed());

  function dismissOne(nome: string) {
    const next = { ...dismissed, [nome]: Date.now() };
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  }
  function dismissAll() {
    const now = Date.now();
    const next = { ...dismissed };
    stats.profsSemPonto.forEach(n => { next[n] = now; });
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
  }
  const profsSemPontoVisiveis = stats.profsSemPonto.filter(n => !dismissed[n]);

  useEffect(() => {
    loadStats();
    // Renova a lista quando vira o dia (limpa avisos antigos e recarrega).
    // Pausa o polling com a aba em segundo plano para não gastar requisições à toa.
    const tick = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setDismissed(loadDismissed());
      loadStats();
    }, 60 * 1000);
    function onVisible() {
      if (document.visibilityState === 'visible') loadStats();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  async function loadStats() {
    const now = new Date();
    const q = quinzenaAtual();
    const hoje = todayLocalISO();
    // dia da semana (1..6 = seg..sáb) compatível com horarios_aula.dia_semana
    const diaSemana = now.getDay() === 0 ? 7 : now.getDay();

    const [{ data: profs }, { data: mats }, { data: turmas }, { data: registros }, { data: regHoje }, { data: gradeHoje }, calLet] = await Promise.all([
      supabase.from('professores').select('id, nome, status'),
      supabase.from('materias').select('id, nome, curso_id'),
      supabase.from('turmas').select('id, nome'),
      supabase.from('registros_ponto').select('*').gte('data', q.ini).lte('data', q.fim).order('created_at', { ascending: false }),
      supabase.from('registros_ponto').select('professor_id').eq('data', hoje),
      supabase.from('horarios_aula').select('professor_id').eq('dia_semana', diaSemana),
      (supabase as any).rpc('is_dia_letivo', { d: hoje }),
    ]);

    const profsAtivos = (profs || []).filter((p: any) => p.status === 'ativo');
    const totalHoras = (registros || []).reduce((s: number, r: any) => s + r.carga_horaria, 0);
    const totalValor = (registros || []).reduce((s: number, r: any) => s + Number(r.valor_total), 0);

    const profHoras: Record<string, { horas: number; valor: number }> = {};
    (registros || []).forEach((r: any) => {
      if (!profHoras[r.professor_id]) profHoras[r.professor_id] = { horas: 0, valor: 0 };
      profHoras[r.professor_id].horas += r.quantidade_horarios;
      profHoras[r.professor_id].valor += Number(r.valor_total);
    });

    const profsMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.nome]));
    const chartPorProf = Object.entries(profHoras)
      .map(([id, data]) => ({ name: (profsMap[id] || '').split(' ')[0], horas: data.horas, valor: data.valor }))
      .sort((a, b) => b.horas - a.horas).slice(0, 8);

    const cursoMap: Record<string, number> = {};
    const cursoLabel: Record<string, string> = { dir: 'Direito', adm: 'Administração', ped: 'Pedagogia' };
    (registros || []).forEach((r: any) => {
      const mat = (mats || []).find((m: any) => m.id === r.materia_id);
      const curso = cursoLabel[mat?.curso_id as string] || 'Outro';
      cursoMap[curso] = (cursoMap[curso] || 0) + r.quantidade_horarios;
    });
    const chartPorCurso = Object.entries(cursoMap).map(([name, value]) => ({ name, value }));

    // Professores sem ponto HOJE — somente os que tinham aula programada hoje E hoje é dia letivo.
    const isLetivo = (calLet as any)?.data ?? true;
    let profsSemPonto: string[] = [];
    if (isLetivo) {
      const profsComAulaHoje = new Set((gradeHoje || []).map((g: any) => g.professor_id));
      const profsComPonto = new Set((regHoje || []).map((r: any) => r.professor_id));
      profsSemPonto = profsAtivos
        .filter(p => profsComAulaHoje.has(p.id) && !profsComPonto.has(p.id))
        .map(p => p.nome);
    }

    setStats({
      professores: profsAtivos.length,
      materias: (mats || []).length,
      turmas: (turmas || []).length,
      registrosHoje: (regHoje || []).length,
      totalHorasMes: totalHoras,
      totalValorMes: totalValor,
      ultimosRegistros: (registros || []).slice(0, 5),
      profsMap,
      matsMap: Object.fromEntries((mats || []).map((m: any) => [m.id, m.nome])),
      turmasMap: Object.fromEntries((turmas || []).map((t: any) => [t.id, t.nome])),
      chartPorProf,
      chartPorCurso,
      profsSemPonto,
    });
  }

  const _q = quinzenaAtual();
  const cards = [
    { label: 'Professores', value: stats.professores, icon: Users, to: '/admin/professores', from: 'from-emerald-500/15', to2: 'to-emerald-500/5', ic: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Matérias', value: stats.materias, icon: BookOpen, to: '/admin/materias', from: 'from-orange-500/15', to2: 'to-orange-500/5', ic: 'text-orange-600 dark:text-orange-400' },
    { label: 'Turmas', value: stats.turmas, icon: GraduationCap, to: '/admin/turmas', from: 'from-amber-500/15', to2: 'to-amber-500/5', ic: 'text-amber-600 dark:text-amber-400' },
    { label: 'Pontos Hoje', value: stats.registrosHoje, icon: Clock, to: '/admin/registros', from: 'from-sky-500/15', to2: 'to-sky-500/5', ic: 'text-sky-600 dark:text-sky-400' },
    { label: `Horas/${_q.label}`, value: `${(stats.totalHorasMes / 60).toFixed(1)}h`, icon: TrendingUp, to: '/admin/relatorios', from: 'from-violet-500/15', to2: 'to-violet-500/5', ic: 'text-violet-600 dark:text-violet-400' },
    { label: `Valor/${_q.label}`, value: `R$ ${stats.totalValorMes.toFixed(0)}`, icon: FileText, to: '/admin/folha-pagamento', from: 'from-primary/15', to2: 'to-primary/5', ic: 'text-primary' },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-baseline gap-3">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Dashboard</h1>
        <div className="gold-divider flex-1 hidden sm:block" />
      </motion.div>
      <p className="text-muted-foreground text-sm -mt-4">Visão geral da {_q.label} atual</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
              <Link to={c.to}>
                <Card className={`glass-card lift-hover cursor-pointer bg-gradient-to-br ${c.from} ${c.to2} border-transparent`}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="icon-badge w-10 h-10 rounded-xl bg-card shadow-md">
                        <Icon size={18} className={c.ic} />
                      </div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-display font-bold tracking-tight animate-count-up tabular-nums">{c.value}</p>
                    <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Alert: professors without attendance */}
      {profsSemPontoVisiveis.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-warning mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Professores sem ponto hoje</p>
                    <button
                      onClick={dismissAll}
                      className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors"
                      aria-label="Limpar todos"
                    >
                      <Trash2 size={12} /> Limpar
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Avisos somem automaticamente em 2 dias</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {profsSemPontoVisiveis.map(nome => (
                      <Badge key={nome} variant="outline" className="text-xs bg-warning/10 pr-1 gap-1">
                        {nome}
                        <button
                          onClick={() => dismissOne(nome)}
                          className="ml-1 rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
                          aria-label={`Excluir ${nome}`}
                        >
                          <X size={10} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Charts */}
      {stats.chartPorProf.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
            <Card className="glass-card lift-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display font-bold">Horas por Professor</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.chartPorProf}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`${v}h/a`, 'Horas']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="horas" radius={[6, 6, 0, 0]}>
                      {stats.chartPorProf.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <Card className="glass-card lift-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display font-bold">Horas por Curso</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats.chartPorCurso} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {stats.chartPorCurso.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Recent Records */}
      {stats.ultimosRegistros.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card className="glass-card lift-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display font-bold">Últimos Registros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.ultimosRegistros.map((r: any, i: number) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.05 }} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{stats.profsMap[r.professor_id] || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.matsMap[r.materia_id]} • {formatDateBR(r.data, 'dd/MM')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{r.quantidade_horarios}h/a</p>
                    <p className="text-xs text-muted-foreground">R$ {Number(r.valor_total).toFixed(2)}</p>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/">
          <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <Card className="gradient-primary text-primary-foreground cursor-pointer border-0" style={{ boxShadow: 'var(--shadow-glow-primary)' }}>
              <CardContent className="p-6 flex flex-col items-center gap-2">
                <Clock size={28} />
                <span className="font-semibold text-sm">Bater Ponto</span>
              </CardContent>
            </Card>
          </motion.div>
        </Link>
        <Link to="/admin/relatorios">
          <motion.div whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <Card className="gradient-accent text-accent-foreground cursor-pointer border-0" style={{ boxShadow: 'var(--shadow-glow-gold)' }}>
              <CardContent className="p-6 flex flex-col items-center gap-2">
                <FileText size={28} />
                <span className="font-semibold text-sm">Relatórios</span>
              </CardContent>
            </Card>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}
