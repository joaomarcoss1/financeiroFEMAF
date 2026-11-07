import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensureNotificationPermission } from '@/lib/push';

export interface Notif {
  id: string;
  destino_role: string;
  professor_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

interface UseNotifsOpts {
  professor_id?: string;
  pin?: string;
  role?: 'professor' | 'admin';
}

export function useNotificacoes({ professor_id, pin, role }: UseNotifsOpts) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const naoLidas = notifs.filter(n => !n.lida).length;

  const load = useCallback(async () => {
    if (professor_id) {
      if (!pin) return setNotifs([]);
      const { data } = await (supabase as any).rpc('notificacoes_professor_listar', {
        p_prof_id: professor_id,
        p_pin: pin,
        p_limite: 30,
      });
      return setNotifs((data || []) as Notif[]);
    }
    let q = supabase.from('notificacoes').select('*').order('created_at', { ascending: false }).limit(30);
    if (role) q = q.eq('destino_role', role);
    const { data } = await q;
    setNotifs((data || []) as Notif[]);
  }, [professor_id, pin, role]);

  useEffect(() => { load(); }, [load]);

  // Recarrega periodicamente sem assinar canais sensíveis em tempo real.
  useEffect(() => {
    if (!professor_id && !role) return;
    const timer = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [professor_id, role, load]);

  // Pede permissão na primeira montagem (silencioso se já decidido)
  useEffect(() => { ensureNotificationPermission(); }, []);

  const marcarLida = useCallback(async (id: string) => {
    if (professor_id && pin) {
      await (supabase as any).rpc('notificacao_professor_marcar_lida', { p_prof_id: professor_id, p_pin: pin, p_notificacao_id: id });
    } else {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    }
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  }, [professor_id, pin]);

  const marcarTodasLidas = useCallback(async () => {
    const ids = notifs.filter(n => !n.lida).map(n => n.id);
    if (ids.length === 0) return;
    if (professor_id && pin) {
      await (supabase as any).rpc('notificacoes_professor_marcar_todas_lidas', { p_prof_id: professor_id, p_pin: pin, p_ids: ids });
    } else {
      await supabase.from('notificacoes').update({ lida: true }).in('id', ids);
    }
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })));
  }, [notifs, professor_id, pin]);

  const excluir = useCallback(async (id: string) => {
    if (professor_id && pin) {
      await (supabase as any).rpc('notificacao_professor_excluir', { p_prof_id: professor_id, p_pin: pin, p_notificacao_id: id });
    } else {
      await supabase.from('notificacoes').delete().eq('id', id);
    }
    setNotifs(prev => prev.filter(n => n.id !== id));
  }, [professor_id, pin]);

  const excluirTodas = useCallback(async () => {
    const ids = notifs.map(n => n.id);
    if (ids.length === 0) return;
    if (professor_id && pin) {
      await (supabase as any).rpc('notificacoes_professor_excluir_todas', { p_prof_id: professor_id, p_pin: pin, p_ids: ids });
    } else {
      await supabase.from('notificacoes').delete().in('id', ids);
    }
    setNotifs([]);
  }, [notifs, professor_id, pin]);

  return { notifs, naoLidas, marcarLida, marcarTodasLidas, excluir, excluirTodas, reload: load };
}
