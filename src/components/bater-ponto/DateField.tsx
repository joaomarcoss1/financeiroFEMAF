import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { parseISO, format } from 'date-fns';

interface Props {
  value: string; // yyyy-MM-dd
  onChange: (v: string) => void;
  max?: string; // yyyy-MM-dd
  className?: string;
  compact?: boolean;
}

// Seletor de data customizado (Popover + Calendar) no lugar do <input type="date">
// nativo do navegador — evita o calendário do SO renderizar fora de posição
// (às vezes flipando para cima e cobrindo o cabeçalho da página) e mantém o
// visual consistente com o resto do sistema em qualquer navegador/SO.
export default function DateField({ value, onChange, max, className, compact }: Props) {
  const selected = value ? parseISO(value) : undefined;
  const maxDate = max ? parseISO(max) : undefined;
  const label = selected
    ? format(selected, compact ? 'dd/MM/yyyy' : "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : compact ? 'dd/mm/aaaa' : 'Selecione a data';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`input-premium h-11 w-full flex items-center gap-2.5 rounded-md border border-input bg-background px-3 text-sm text-left hover:border-primary/40 transition-colors ${className ?? ''}`}
        >
          <CalendarDays size={16} className="text-muted-foreground shrink-0" aria-hidden />
          <span className="capitalize truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && onChange(format(d, 'yyyy-MM-dd'))}
          disabled={maxDate ? { after: maxDate } : undefined}
          defaultMonth={selected}
          locale={ptBR}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
