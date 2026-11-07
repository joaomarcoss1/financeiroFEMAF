import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAssinar } from '../api/documentos';

/** Assinatura eletrônica avançada: exige a senha de novo antes de gravar. */
export function DialogAssinar({ documento, onClose }: { documento: { id: string; titulo: string; codigo: string }; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const assinar = useAssinar();
  const [senha, setSenha] = useState('');

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    try {
      const r = await assinar.mutateAsync({ id: documento.id, email: user.email, senha });
      toast({ title: 'Documento assinado', description: r.completo ? 'Todas as assinaturas concluídas; PDF final registrado.' : 'Aguardando os próximos signatários.' });
      onClose();
    } catch (x) {
      toast({ title: 'Não foi possível assinar', description: (x as Error).message, variant: 'destructive' });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={confirmar}>
          <DialogHeader>
            <DialogTitle>Assinar documento</DialogTitle>
            <DialogDescription className="break-words">
              {documento.titulo} ({documento.codigo}). Ao confirmar, você assina eletronicamente com data, hora e registro do conteúdo (Lei 14.063/2020).
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 space-y-1">
            <Label htmlFor="ass-senha">Confirme sua senha</Label>
            <Input className="inst-field" id="ass-senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus required />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={!senha || assinar.isPending}>{assinar.isPending ? 'Assinando…' : 'Assinar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
