import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const LINKS = [
  { path: '/central', titulo: 'Central do Aluno', texto: 'Envie aos alunos: protocolos, documentos e primeiro acesso.' },
  { path: '/validar', titulo: 'Validação de documentos', texto: 'Para quem recebe um documento conferir a autenticidade.' },
];

/** Links públicos com QR Code para divulgação. */
export default function Links() {
  return <div className="grid gap-4 md:grid-cols-2">{LINKS.map((l) => <LinkCard key={l.path} {...l} />)}</div>;
}

function LinkCard({ path, titulo, texto }: { path: string; titulo: string; texto: string }) {
  const { toast } = useToast();
  const url = `${window.location.origin}${path}`;
  const [svg, setSvg] = useState('');
  useEffect(() => { void QRCode.toString(url, { type: 'svg', margin: 1, width: 220 }).then(setSvg); }, [url]);

  function baixar() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = `qr-${path.slice(1)}.svg`;
    a.click();
  }

  return (
    <Card className="glass-card rounded-2xl">
      <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{texto}</p>
        {/* SVG gerado localmente pela biblioteca qrcode a partir da nossa própria URL */}
        <div className="mx-auto w-[220px] rounded bg-white p-2" aria-label={`QR Code de ${url}`} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="break-all rounded bg-muted p-2 text-sm font-mono">{url}</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => { void navigator.clipboard.writeText(url); toast({ title: 'Link copiado' }); }}><Copy className="h-4 w-4" /> Copiar</Button>
          <Button size="sm" variant="outline" onClick={baixar} disabled={!svg}><Download className="h-4 w-4" /> Baixar QR</Button>
        </div>
      </CardContent>
    </Card>
  );
}
