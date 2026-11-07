import { Layers } from 'lucide-react';
import JuncaoManager from '@/components/juncoes/JuncaoManager';

export default function JuncoesTurmas() {
  return (
    <JuncaoManager
      table="turma_juncoes"
      idsColumn="turma_ids"
      itemsTable="turmas"
      titulo="Junção de Turmas"
      descricao="Permite ao professor bater ponto no mesmo horário para várias turmas (ex.: aulas conjuntas / extensão)."
      icon={Layers}
      itemLabelPlural="turmas"
      nomePlaceholder="Ex.: Extensão Curricular DIR 5º/6º/7º"
    />
  );
}
