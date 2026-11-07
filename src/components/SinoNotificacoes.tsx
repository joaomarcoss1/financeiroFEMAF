import { Bell, Check, Trash2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  professor_id?: string;
  pin?: string;
  role?: 'professor' | 'admin';
  className?: string;
}

export default function SinoNotificacoes({ professor_id, pin, role, className }: Props) {
  const { notifs, naoLidas, marcarLida, marcarTodasLidas, excluir, excluirTodas } = useNotificacoes({ professor_id, pin, role });
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`relative p-2 rounded-lg hover:bg-foreground/10 transition-colors ${className || ''}`}
          aria-label="Notificações"
        >
          <Bell size={20} />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border gap-2">
          <p className="font-semibold text-sm">Notificações</p>
          <div className="flex items-center gap-1">
            {naoLidas > 0 && (
              <Button variant="ghost" size="sm" onClick={marcarTodasLidas} className="h-7 text-xs gap-1">
                <Check size={12} /> Lidas
              </Button>
            )}
            {notifs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { if (confirm('Excluir todas as notificações?')) excluirTodas(); }}
                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
              >
                <Trash2 size={12} /> Limpar
              </Button>
            )}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma notificação</p>
          )}
          {notifs.map(n => (
            <div
              key={n.id}
              className={`group relative w-full border-b border-border/50 hover:bg-muted/50 transition-colors ${!n.lida ? 'bg-primary/5' : ''}`}
            >
              <button
                onClick={() => { marcarLida(n.id); if (n.link) navigate(n.link); }}
                className="w-full text-left p-3 pr-9"
              >
                <div className="flex items-start gap-2">
                  {!n.lida && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.titulo}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); excluir(n.id); }}
                className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Excluir notificação"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
