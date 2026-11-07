import { BookOpen } from 'lucide-react';
import JuncaoManager from '@/components/juncoes/JuncaoManager';

export default function JuncoesDisciplinas() {
  return (
    <JuncaoManager
      table="materia_juncoes"
      idsColumn="materia_ids"
      itemsTable="materias"
      titulo="Junção de Disciplinas"
      descricao="Permite ao professor bater ponto no mesmo horário para duas disciplinas distintas (ex.: aulas integradas)."
      icon={BookOpen}
      itemLabelPlural="disciplinas"
      nomePlaceholder="Ex.: Direito Civil + Direito Processual"
    />
  );
}
