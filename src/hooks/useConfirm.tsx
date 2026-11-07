import { useCallback, useRef, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title?: string;
  /** Texto do botão de confirmação (padrão "Confirmar"). */
  confirmLabel?: string;
  /** Estilo destrutivo (vermelho) para ações como excluir. */
  danger?: boolean;
}

/**
 * Substitui o `window.confirm()` nativo por um AlertDialog consistente com o
 * design do app. Uso: `if (!(await confirm('Excluir item?'))) return;`
 * — mesma forma de uso do confirm() nativo, só que assíncrona.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState<ConfirmOptions>({});
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((msg: string, opts: ConfirmOptions = {}) => {
    setMessage(msg);
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  function handle(result: boolean) {
    setOpen(false);
    resolver.current?.(result);
  }

  const ConfirmDialog = (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) handle(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title || 'Confirmar ação'}</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handle(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handle(true)}
            className={options.danger ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
          >
            {options.confirmLabel || 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
