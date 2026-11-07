import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { setCoordSession } from '@/lib/coordSession';
import logoFemaf from '@/assets/logo-femaf.png';
import PageBackground from '@/components/PageBackground';

export default function CoordenadorLogin() {
  const [nome, setNome] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !pin.trim()) {
      toast({ title: 'Informe nome completo e PIN', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('coordenador_login', {
      p_nome: nome.trim(),
      p_pin: pin.trim(),
    });
    setLoading(false);
    if (error || !data) {
      toast({ title: 'Acesso negado', description: 'Nome ou PIN inválidos', variant: 'destructive' });
      return;
    }
    const sess = data as { id: string; nome: string; cursos: string[] };
    setCoordSession({ id: sess.id, nome: sess.nome, cursos: sess.cursos, pin: pin.trim() });
    navigate('/coordenador');
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 lg:p-8">
      <PageBackground />
      <div className="w-full max-w-sm mx-auto">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="text-center space-y-3">
              <img src={logoFemaf} alt="FEMAF" className="h-14 mx-auto rounded-xl shadow-md" />
              <span className="eyebrow justify-center">
                <ShieldCheck size={12} /> Coordenação acadêmica
              </span>
              <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">Área da Coordenação</h1>
              <p className="text-muted-foreground text-sm">Acesse com seu nome completo e PIN</p>
            </div>

            <Card className="premium-card">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>Nome completo</Label>
                    <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome como cadastrado" autoComplete="off" className="input-premium mt-1" />
                  </div>
                  <div>
                    <Label>PIN</Label>
                    <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" className="input-premium mt-1" />
                  </div>
                  <motion.div whileTap={{ scale: 0.98 }}>
                    <Button type="submit" className="w-full h-12 gap-2 btn-glow btn-premium" disabled={loading}>
                      <ShieldCheck size={18} /> {loading ? 'Entrando…' : 'Entrar como coordenador'}
                    </Button>
                  </motion.div>
                </form>
              </CardContent>
            </Card>

            <Button variant="ghost" className="w-full gap-2" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Voltar para Bater Ponto
            </Button>
          </motion.div>
        </div>
    </div>
  );
}
