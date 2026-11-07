import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Settings, UserPlus, Trash2, Users, Shield, CalendarDays, MapPin, Palette, Clock, GraduationCap, Plus } from 'lucide-react';
import CalendarioAdmin from '@/components/configuracoes/CalendarioAdmin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { getAppSettings, saveAppSettings, DEFAULT_SETTINGS, DEFAULT_MENU_ITEMS, type AppSettings, type HorarioCfg, type CursoCfg, type MenuItemCfg } from '@/lib/appSettings';

const MENU_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  professores: 'Professores',
  materias: 'Matérias',
  turmas: 'Turmas',
  grade: 'Grade Horários',
  registros: 'Registros',
  relatorios: 'Relatórios',
  folha: 'Folha de Pagamento',
  secretaria: 'Secretaria (protocolos)',
  configuracoes: 'Configurações',
  instalar: 'Instalar App',
};

export default function Configuracoes() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<{ id: string; user_id: string; email: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [cfg, setCfg] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => { loadAdmins(); getAppSettings(true).then(setCfg).catch(() => {}); }, []);

  async function handleSaveCfg() {
    setSavingCfg(true);
    try {
      // validações simples
      const g = cfg.geofence;
      if (!Number.isFinite(g.lat) || !Number.isFinite(g.lng) || !Number.isFinite(g.raio_m) || g.raio_m < 10) {
        toast({ title: 'Geofence inválido', description: 'Confira latitude, longitude e raio (>=10m).', variant: 'destructive' });
        return;
      }
      if (!cfg.cursos.length || cfg.cursos.some(c => !c.id || !c.nome)) {
        toast({ title: 'Cursos inválidos', description: 'Cada curso precisa de ID e nome.', variant: 'destructive' });
        return;
      }
      if (cfg.horarios.some(h => !h.label || !h.inicio || !h.fim)) {
        toast({ title: 'Horários inválidos', description: 'Preencha label, início e fim.', variant: 'destructive' });
        return;
      }
      await saveAppSettings(cfg);
      toast({ title: 'Configurações salvas!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSavingCfg(false);
    }
  }


  async function loadAdmins() {
    const { data: roles } = await supabase.from('user_roles').select('id, user_id, role').eq('role', 'admin');
    setAdmins((roles || []).map((r: any) => ({
      id: r.id, user_id: r.user_id,
      email: r.user_id === user?.id ? user.email || '' : r.user_id,
    })));
  }

  async function handleCreateAdmin() {
    if (!newEmail || !newPassword) { toast({ title: 'Preencha email e senha', variant: 'destructive' }); return; }
    if (newPassword.length < 6) { toast({ title: 'Senha: mínimo 6 caracteres', variant: 'destructive' }); return; }

    setLoading(true);
    const { data, error } = await supabase.functions.invoke('create-admin', {
      body: { email: newEmail, password: newPassword },
    });

    if (error || data?.error) {
      toast({ title: 'Erro ao criar admin', description: data?.error || error?.message, variant: 'destructive' });
      setLoading(false); return;
    }

    toast({ title: 'Administrador criado com sucesso!' });
    setLoading(false); setDialogOpen(false);
    setNewEmail(''); setNewPassword('');
    loadAdmins();
  }

  async function handleRemoveAdmin(roleId: string, userId: string) {
    if (userId === user?.id) { toast({ title: 'Você não pode remover a si mesmo', variant: 'destructive' }); return; }
    if (!confirm('Remover este administrador?')) return;
    await supabase.from('user_roles').delete().eq('id', roleId);
    toast({ title: 'Administrador removido' });
    loadAdmins();
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Settings size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Gerenciar administradores</p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2"><Shield size={18} className="text-primary" /> Administradores</span>
              <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
                <UserPlus size={14} /> Novo
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {admins.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.email}</p>
                    <Badge variant="default" className="text-[10px]">admin</Badge>
                  </div>
                </div>
                {a.user_id !== user?.id && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveAdmin(a.id, a.user_id)}>
                    <Trash2 size={14} className="text-destructive" />
                  </Button>
                )}
              </motion.div>
            ))}
            {admins.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum administrador</p>}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays size={18} className="text-primary" /> Calendário Acadêmico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Gerencie sábados letivos, reposições, eventos, feriados e recessos. Use para liberar
              o ponto em datas fora do padrão.
            </p>
            <CalendarioAdmin />
          </CardContent>
        </Card>
      </motion.div>

      {/* PERSONALIZAÇÃO GLOBAL */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette size={18} className="text-primary" /> Personalização do App
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2"><MapPin size={14} className="text-primary" /><Label className="text-sm font-semibold">Geofence (área permitida para bater ponto)</Label></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-[10px]">Latitude</Label><Input type="number" step="0.0000001" value={cfg.geofence.lat} onChange={e => setCfg(c => ({ ...c, geofence: { ...c.geofence, lat: parseFloat(e.target.value) } }))} /></div>
                <div><Label className="text-[10px]">Longitude</Label><Input type="number" step="0.0000001" value={cfg.geofence.lng} onChange={e => setCfg(c => ({ ...c, geofence: { ...c.geofence, lng: parseFloat(e.target.value) } }))} /></div>
                <div><Label className="text-[10px]">Raio (m)</Label><Input type="number" min="10" value={cfg.geofence.raio_m} onChange={e => setCfg(c => ({ ...c, geofence: { ...c.geofence, raio_m: parseInt(e.target.value) || 0 } }))} /></div>
              </div>
              <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={() => {
                if (!navigator.geolocation) return;
                navigator.geolocation.getCurrentPosition(pos => {
                  setCfg(c => ({ ...c, geofence: { ...c.geofence, lat: pos.coords.latitude, lng: pos.coords.longitude } }));
                  toast({ title: 'Coordenadas atuais aplicadas' });
                });
              }}>Usar minha localização atual</Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1"><Palette size={14} /> Cor primária (HSL)</Label>
                <Input value={cfg.primary_hsl} onChange={e => setCfg(c => ({ ...c, primary_hsl: e.target.value }))} placeholder="246 76% 28%" />
                <div className="flex gap-1 mt-2 flex-wrap">
                  {[
                    { l: 'FEMAF', v: '246 76% 28%' },
                    { l: 'Azul royal', v: '208 91% 44%' },
                    { l: 'Roxo', v: '262 83% 58%' },
                    { l: 'Verde', v: '152 60% 32%' },
                    { l: 'Rosa', v: '340 82% 52%' },
                  ].map(p => (
                    <button key={p.v} type="button" onClick={() => setCfg(c => ({ ...c, primary_hsl: p.v }))}
                      className="px-2 py-1 rounded-md text-[10px] border border-border hover:scale-105 transition-transform"
                      style={{ background: `hsl(${p.v})`, color: '#fff' }}>{p.l}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Minutos por horário</Label>
                <Input type="number" min="1" value={cfg.minutos_por_horario} onChange={e => setCfg(c => ({ ...c, minutos_por_horario: parseInt(e.target.value) || 50 }))} />
                <Label className="text-sm font-semibold mt-3 block">Valor padrão H/A (R$)</Label>
                <Input type="number" step="0.01" min="0" value={cfg.valor_hora_padrao} onChange={e => setCfg(c => ({ ...c, valor_hora_padrao: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><GraduationCap size={14} className="text-primary" /><Label className="text-sm font-semibold">Cursos</Label></div>
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setCfg(c => ({ ...c, cursos: [...c.cursos, { id: '', nome: '' }] }))}><Plus size={12} /> Adicionar</Button>
              </div>
              <div className="space-y-2">
                {cfg.cursos.map((curso, idx) => (
                  <div key={idx} className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                    <Input placeholder="id" value={curso.id} onChange={e => setCfg(c => { const arr = [...c.cursos]; arr[idx] = { ...arr[idx], id: e.target.value.toLowerCase().slice(0, 8) }; return { ...c, cursos: arr }; })} />
                    <Input placeholder="Nome do curso" value={curso.nome} onChange={e => setCfg(c => { const arr = [...c.cursos]; arr[idx] = { ...arr[idx], nome: e.target.value }; return { ...c, cursos: arr }; })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCfg(c => ({ ...c, cursos: c.cursos.filter((_, i) => i !== idx) }))}><Trash2 size={14} className="text-destructive" /></Button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">ID curto (ex: ped, dir, adm). Alterar o ID de um curso já em uso pode quebrar turmas existentes.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Clock size={14} className="text-primary" /><Label className="text-sm font-semibold">Horários do dia</Label></div>
                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setCfg(c => {
                  const nextId = (Math.max(0, ...c.horarios.map(h => h.id)) + 1);
                  return { ...c, horarios: [...c.horarios, { id: nextId, label: `${nextId}º Horário`, inicio: '08:00', fim: '08:50', turno: 'matutino' }] };
                })}><Plus size={12} /> Adicionar</Button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {cfg.horarios.map((h, idx) => (
                  <div key={idx} className="grid grid-cols-[40px_1fr_90px_90px_110px_auto] gap-1.5 items-center text-xs">
                    <Input type="number" value={h.id} onChange={e => setCfg(c => { const a = [...c.horarios]; a[idx] = { ...a[idx], id: parseInt(e.target.value) || 0 }; return { ...c, horarios: a }; })} />
                    <Input value={h.label} onChange={e => setCfg(c => { const a = [...c.horarios]; a[idx] = { ...a[idx], label: e.target.value }; return { ...c, horarios: a }; })} />
                    <Input type="time" value={h.inicio} onChange={e => setCfg(c => { const a = [...c.horarios]; a[idx] = { ...a[idx], inicio: e.target.value }; return { ...c, horarios: a }; })} />
                    <Input type="time" value={h.fim} onChange={e => setCfg(c => { const a = [...c.horarios]; a[idx] = { ...a[idx], fim: e.target.value }; return { ...c, horarios: a }; })} />
                    <Input value={h.turno} placeholder="turno" onChange={e => setCfg(c => { const a = [...c.horarios]; a[idx] = { ...a[idx], turno: e.target.value }; return { ...c, horarios: a }; })} />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCfg(c => ({ ...c, horarios: c.horarios.filter((_, i) => i !== idx) }))}><Trash2 size={14} className="text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex items-center gap-2"><Settings size={14} className="text-primary" /><Label className="text-sm font-semibold">Itens do menu lateral (admin)</Label></div>
              <p className="text-[10px] text-muted-foreground">Desabilite seções para ocultá-las do menu. As rotas continuam acessíveis via URL para administradores.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {(cfg.menu_items || DEFAULT_MENU_ITEMS).map((mi, idx) => (
                  <label key={mi.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={mi.enabled}
                      onChange={e => setCfg(c => {
                        const items = [...(c.menu_items || DEFAULT_MENU_ITEMS)];
                        items[idx] = { ...items[idx], enabled: e.target.checked };
                        return { ...c, menu_items: items };
                      })}
                    />
                    {MENU_LABELS[mi.key] || mi.key}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button onClick={handleSaveCfg} disabled={savingCfg} className="flex-1">{savingCfg ? 'Salvando...' : 'Salvar configurações'}</Button>
              <Button variant="outline" onClick={() => getAppSettings(true).then(setCfg)}>Recarregar</Button>
            </div>
            <p className="text-[10px] text-muted-foreground">As alterações afetam todo o app (incluindo a tela pública de bater ponto e a validação no servidor).</p>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Administrador</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>E-mail</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@femaf.edu.br" /></div>
            <div><Label>Senha</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
            <Button onClick={handleCreateAdmin} className="w-full" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Administrador'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
