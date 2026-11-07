import { useEffect, useState } from 'react';
import { AppSettings, DEFAULT_SETTINGS, getAppSettings, onSettingsChange } from '@/lib/appSettings';

/**
 * Hook reativo para as configurações globais.
 * Re-renderiza componentes quando as settings mudam (após save em /admin/configuracoes).
 */
export function useAppSettings(): AppSettings {
  const [s, setS] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    let alive = true;
    getAppSettings().then(v => { if (alive) setS(v); }).catch(() => {});
    const off = onSettingsChange((v) => setS(v));
    return () => { alive = false; off(); };
  }, []);
  return s;
}
