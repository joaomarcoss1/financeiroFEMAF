import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Check, Search, X } from 'lucide-react';
import type { Professor } from '@/lib/types';

interface Props {
  professores: Professor[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  excludeId?: string;
  ariaLabel?: string;
}

export default function ProfessorCombobox({
  professores,
  value,
  onChange,
  placeholder = 'Digite o nome do professor...',
  excludeId,
  ariaLabel,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = professores.find((p) => p.id === value);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const list = professores
    .filter((p) => p.id !== excludeId)
    .filter((p) => {
      if (!query.trim()) return true;
      const q = query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const n = p.nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return n.includes(q);
    })
    .slice(0, 8);

  return (
    <div ref={wrapRef} className="relative mt-1">
      {selected && !open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setQuery('');
          }}
          className="w-full flex items-center justify-between gap-2 h-11 px-3.5 rounded-lg border border-input bg-background text-sm text-left transition-colors duration-200 hover:border-primary/40"
          aria-label={ariaLabel}
        >
          <span className="truncate font-medium">{selected.nome}</span>
          <X
            size={14}
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
            }}
          />
        </button>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="h-11 pl-9"
            aria-label={ariaLabel}
            autoComplete="off"
          />
        </div>
      )}

      {open && list.length > 0 && (!selected || query.length > 0) && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 w-full max-h-64 overflow-auto rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl p-1 shadow-premium animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
        >
          {list.map((p) => {
            const isSel = p.id === value;
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={isSel}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  isSel ? 'bg-primary/8 font-semibold text-primary' : 'hover:bg-accent'
                }`}
              >
                <span className="truncate">{p.nome}</span>
                {isSel && <Check size={14} className="text-primary shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}

      {open && query.trim() && list.length === 0 && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl p-3 text-sm text-muted-foreground shadow-premium animate-in fade-in-0 zoom-in-95 duration-150">
          Nenhum professor encontrado
        </div>
      )}
    </div>
  );
}
