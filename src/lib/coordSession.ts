// Sessão simples do coordenador armazenada em sessionStorage.
// O PIN só vive na aba enquanto o coord está logado; é reenviado em cada RPC
// para validação server-side (SECURITY DEFINER).

const KEY = 'coord_session_v1';

export interface CoordSession {
  id: string;
  nome: string;
  pin: string;
  cursos: string[];
}

export function getCoordSession(): CoordSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CoordSession;
  } catch {
    return null;
  }
}

export function setCoordSession(s: CoordSession) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function clearCoordSession() {
  sessionStorage.removeItem(KEY);
}
