import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { todayLocalISO, formatDateBR } from '@/lib/datetime';

type Tipo = 'feriado' | 'recesso' | 'sabado_letivo' | 'reposicao' | 'evento' | 'prova';
type Entry = { data: string; tipo: Tipo; descricao: string };

const TIPO_LABEL: Record<Tipo, { label: string; tone: string }> = {
  feriado:        { label: 'Feriado',          tone: 'bg-destructive/15 text-destructive border-destructive/30' },
  recesso:        { label: 'Recesso',          tone: 'bg-destructive/10 text-destructive border-destructive/20' },
  sabado_letivo:  { label: 'Sábado Letivo',    tone: 'bg-primary/15 text-primary border-primary/30' },
  reposicao:      { label: 'Reposição',        tone: 'bg-primary/10 text-primary border-primary/20' },
  evento:         { label: 'Evento',           tone: 'bg-secondary/20 text-secondary-foreground border-secondary/30' },
  prova:          { label: 'Prova',            tone: 'bg-accent/15 text-accent-foreground border-accent/30' },
};

export default function CalendarioAdmin() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [data, setData] = useState(todayLocalISO());
  const [tipo, setTipo] = useState<Tipo>('sabado_letivo');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) load(); }, [open]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('calendario_academico')
      .select('data, tipo, descricao')
      .order('data', { ascending: true });
    if (error) toast({ title: 'Erro ao carregar calendário', description: error.message, variant: 'destructive' });
    setEntries((data || []) as Entry[]);
    setLoading(false);
  }

  async function handleSave() {
    if (!data || !descricao.trim()) {
      toast({ title: 'Preencha data e descrição', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('calendario_academico')
      .upsert({ data, tipo, descricao: descricao.trim() }, { onConflict: 'data' });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Dia salvo no calendário' });
    setDescricao('');
    load();
  }

  async function handleDelete(d: string) {
    if (!confirm('Remover este dia do calendário?')) return;
    const { error } = await supabase.from('calendario_academico').delete().eq('data', d);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Dia removido' });
    load();
  }

  const proximos = useMemo(() => {
    const hoje = todayLocalISO();
    return entries.filter(e => e.data >= hoje);
  }, [entries]);

  const passados = useMemo(() => {
    const hoje = todayLocalISO();
    return entries.filter(e => e.data < hoje).reverse();
  }, [entries]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2 hover:bg-primary/5 active:scale-[0.99] transition-transform">
          <CalendarDays size={16} className="text-primary" />
          Calendário Acadêmico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            Calendário Acadêmico
          </DialogTitle>
        </DialogHeader>

        {/* Formulário */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus size={14} /> Adicionar / atualizar dia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={data} onChange={e => setData(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sabado_letivo">Sábado Letivo</SelectItem>
                    <SelectItem value="reposicao">Reposição</SelectItem>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="prova">Prova</SelectItem>
                    <SelectItem value="feriado">Feriado (bloqueia)</SelectItem>
                    <SelectItem value="recesso">Recesso (bloqueia)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: Sábado letivo - reposição da semana 3"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full active:scale-[0.98] transition-transform">
              {saving ? 'Salvando...' : 'Salvar dia'}
            </Button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Dica: para liberar ponto em sábado, feriado ou recesso, cadastre como{' '}
              <strong>Sábado Letivo</strong>, <strong>Reposição</strong> ou <strong>Evento</strong>.
            </p>
          </CardContent>
        </Card>

        {/* Listagem */}
        <div className="space-y-3">
          <Section title="Próximos eventos" entries={proximos} loading={loading} onDelete={handleDelete} />
          {passados.length > 0 && (
            <Section title="Históricos" entries={passados.slice(0, 20)} loading={false} onDelete={handleDelete} muted />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title, entries, loading, onDelete, muted = false,
}: { title: string; entries: Entry[]; loading: boolean; onDelete: (d: string) => void; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
      {!loading && entries.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nenhum registro.</p>
      )}
      <AnimatePresence initial={false}>
        <div className="space-y-1.5">
          {entries.map((e, i) => {
            const meta = TIPO_LABEL[e.tipo];
            return (
              <motion.div
                key={e.data}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: muted ? 0.7 : 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18, delay: Math.min(i * 0.02, 0.15) }}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{formatDateBR(e.data)}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${meta.tone}`}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{e.descricao}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 active:scale-90 transition-transform"
                  onClick={() => onDelete(e.data)}
                  aria-label={`Remover ${e.descricao}`}
                >
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
}
