import { supabase } from '@/integrations/supabase/client';
import { CURSOS, HORARIOS, _setMinutosPorHorario } from '@/lib/types';

export interface HorarioCfg { id: number; label: string; inicio: string; fim: string; turno: string }
export interface CursoCfg { id: string; nome: string }
export interface MenuItemCfg { key: string; enabled: boolean }
export interface ProvasCfg { ativo: boolean; data_inicio: string | null; data_fim: string | null }
export interface AppSettings {
  geofence: { lat: number; lng: number; raio_m: number };
  minutos_por_horario: number;
  minutos_pagamento_hora_aula?: number;
  valor_hora_padrao: number;
  primary_hsl: string;
  horarios: HorarioCfg[];
  cursos: CursoCfg[];
  menu_items?: MenuItemCfg[];
  provas?: ProvasCfg;
}

export const DEFAULT_MENU_ITEMS: MenuItemCfg[] = [
  { key: 'dashboard', enabled: true },
  { key: 'professores', enabled: true },
  { key: 'materias', enabled: true },
  { key: 'turmas', enabled: true },
  { key: 'grade', enabled: true },
  { key: 'juncoes', enabled: true },
  { key: 'juncoes_disc', enabled: true },
  { key: 'permutas', enabled: true },
  { key: 'registros', enabled: true },
  { key: 'relatorios', enabled: true },
  { key: 'folha', enabled: true },
  { key: 'feriados', enabled: true },
  { key: 'administrativo', enabled: true },
  { key: 'provas', enabled: true },
  { key: 'secretaria', enabled: true },
  { key: 'configuracoes', enabled: true },
  { key: 'instalar', enabled: true },
];

export const DEFAULT_SETTINGS: AppSettings = {
  geofence: { lat: -4.5635410, lng: -44.5994555, raio_m: 900 },
  minutos_por_horario: 50,
  minutos_pagamento_hora_aula: 60,
  valor_hora_padrao: 0,
  primary_hsl: '246 76% 28%',
  horarios: [
    { id: 1, label: '1º Horário', inicio: '18:30', fim: '19:20', turno: 'noturno' },
    { id: 2, label: '2º Horário', inicio: '19:20', fim: '20:10', turno: 'noturno' },
    { id: 3, label: '3º Horário', inicio: '20:20', fim: '21:10', turno: 'noturno' },
    { id: 4, label: '4º Horário', inicio: '21:10', fim: '22:00', turno: 'noturno' },
    { id: 5, label: '1º Horário', inicio: '14:00', fim: '15:00', turno: 'vespertino' },
    { id: 6, label: '2º Horário', inicio: '15:00', fim: '16:00', turno: 'vespertino' },
    { id: 7, label: '3º Horário', inicio: '16:00', fim: '17:00', turno: 'vespertino' },
    { id: 8, label: '4º Horário', inicio: '17:00', fim: '18:00', turno: 'vespertino' },
  ],
  cursos: [
    { id: 'eng', nome: 'Engenharia Civil' },
    { id: 'ped', nome: 'Pedagogia' },
    { id: 'psi', nome: 'Psicologia' },
  ],
  menu_items: DEFAULT_MENU_ITEMS,
  provas: { ativo: false, data_inicio: null, data_fim: null },
};

export function isProvasAtivo(cfg?: ProvasCfg): boolean {
  if (!cfg || !cfg.ativo) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  if (cfg.data_inicio && hoje < cfg.data_inicio) return false;
  if (cfg.data_fim && hoje > cfg.data_fim) return false;
  return true;
}

let cache: AppSettings | null = null;
let cacheAt = 0;
const TTL = 60_000;
const listeners = new Set<(s: AppSettings) => void>();

function applySettingsToConstants(s: AppSettings) {
  CURSOS.splice(0, CURSOS.length, ...s.cursos);
  HORARIOS.splice(0, HORARIOS.length, ...s.horarios);
  _setMinutosPorHorario(s.minutos_por_horario);
}

export async function getAppSettings(force = false): Promise<AppSettings> {
  if (!force && cache && Date.now() - cacheAt < TTL) return cache;
  const { data } = await (supabase as any).from('app_settings').select('data').eq('id', 'global').maybeSingle();
  const raw = (data?.data || {}) as Partial<AppSettings>;
  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...raw,
    menu_items: raw.menu_items && raw.menu_items.length
      ? DEFAULT_MENU_ITEMS.map(d => ({ ...d, ...(raw.menu_items!.find(m => m.key === d.key) || {}) }))
      : DEFAULT_MENU_ITEMS,
  };
  cache = merged;
  cacheAt = Date.now();
  applyPrimaryColor(merged.primary_hsl);
  applySettingsToConstants(merged);
  listeners.forEach((fn) => fn(merged));
  return merged;
}

export async function saveAppSettings(s: AppSettings): Promise<void> {
  await (supabase as any).from('app_settings').upsert({ id: 'global', data: s as any, updated_at: new Date().toISOString() });
  cache = s;
  cacheAt = Date.now();
  applyPrimaryColor(s.primary_hsl);
  applySettingsToConstants(s);
  listeners.forEach((fn) => fn(s));
}

export function applyPrimaryColor(hsl: string) {
  if (typeof document === 'undefined' || !hsl) return;
  document.documentElement.style.setProperty('--primary', hsl);
}

export function onSettingsChange(fn: (s: AppSettings) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function clearSettingsCache() { cache = null; cacheAt = 0; }
