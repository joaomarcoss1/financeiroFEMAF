import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Mostra o PDF com pdfjs-dist (funciona no celular, onde iframe de PDF falha). */
export function VisualizadorPdf({ blob, titulo, onClose }: { blob: Blob; titulo: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        const alvo = ref.current;
        if (!alvo || cancelado) return;
        alvo.innerHTML = '';
        const largura = Math.min(alvo.clientWidth || 800, 900);
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (largura / base.width) * (window.devicePixelRatio || 1) });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = '100%';
          canvas.className = 'mb-3 rounded border bg-white';
          alvo.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
          if (cancelado) return;
        }
      } catch (e) {
        setErro((e as Error).message);
      }
    })();
    return () => { cancelado = true; };
  }, [blob]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6 break-words">{titulo}</DialogTitle></DialogHeader>
        {erro ? <p className="text-sm text-destructive">Não foi possível exibir: {erro}</p> : <div ref={ref} className="w-full" />}
      </DialogContent>
    </Dialog>
  );
}
