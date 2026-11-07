import type { ReactNode, ElementType } from 'react';

export function SectionLabel({ icon: Icon, children }: { icon: ElementType; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-foreground/75 mb-2">
      <span className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary shrink-0">
        <Icon size={13} aria-hidden />
      </span>
      {children}
    </div>
  );
}

export function InlineNote({ tone, children }: { tone: 'destructive' | 'warning' | 'primary' | 'muted'; children: ReactNode }) {
  const toneClass = {
    destructive: 'border-destructive/60 text-destructive',
    warning: 'border-warning/60 text-amber-700 dark:text-warning',
    primary: 'border-primary/50 text-foreground/80',
    muted: 'border-border text-muted-foreground',
  }[tone];
  return <div className={`border-l-2 pl-3 py-0.5 text-xs leading-relaxed ${toneClass}`}>{children}</div>;
}
