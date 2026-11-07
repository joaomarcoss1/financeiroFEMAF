import { useCallback, useEffect, useState } from 'react';
import type { GpsState } from '@/components/bater-ponto/GpsStatus';

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface GpsResult {
  status: GpsState;
  lat: number | null;
  lng: number | null;
  distancia: number | null;
  accuracy: number | null;
  refresh: () => void;
}

export function useGps(targetLat: number, targetLng: number, raioMax: number): GpsResult {
  const [status, setStatus] = useState<GpsState>('checking');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }
    setStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        setAccuracy(Math.round(acc));
        const dist = calcularDistancia(latitude, longitude, targetLat, targetLng);
        setDistancia(Math.round(dist));
        setStatus(dist <= raioMax ? 'ok' : 'far');
      },
      (err) => setStatus(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [targetLat, targetLng, raioMax]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, lat, lng, distancia, accuracy, refresh };
}
