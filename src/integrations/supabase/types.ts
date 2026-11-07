export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_day_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          is_active: boolean
          scope_id: string | null
          scope_type: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          is_active?: boolean
          scope_id?: string | null
          scope_type?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_active?: boolean
          scope_id?: string | null
          scope_type?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ajustes_folha_administrativo: {
        Row: {
          created_at: string
          folha_id: string | null
          funcionario_id: string
          id: string
          motivo: string | null
          observacao: string | null
          periodo_fim: string
          periodo_inicio: string
          quantidade_horas: number | null
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          folha_id?: string | null
          funcionario_id: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          periodo_fim: string
          periodo_inicio: string
          quantidade_horas?: number | null
          tipo: string
          valor?: number
        }
        Update: {
          created_at?: string
          folha_id?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string | null
          observacao?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          quantidade_horas?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_folha_administrativo_folha_id_fkey"
            columns: ["folha_id"]
            isOneToOne: false
            referencedRelation: "folha_administrativo_apoio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_folha_administrativo_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_administrativos"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_financeiros_log: {
        Row: {
          accepted_at: string | null
          created_at: string
          data_obrigacao: string | null
          data_referencia: string
          delivered_at: string | null
          despesas: Json
          destinatario_id: string | null
          destinatario_nome: string | null
          erro: string | null
          erro_codigo: string | null
          erro_detalhe: Json | null
          erro_titulo: string | null
          external_id: string | null
          failed_at: string | null
          http_status: number | null
          id: string
          mensagem: string | null
          read_at: string | null
          resposta_meta: Json | null
          sent_at: string | null
          status: string
          status_atualizado_em: string | null
          telefone: string | null
          template_language: string | null
          template_name: string | null
          tentativas: number
          tipo: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          data_obrigacao?: string | null
          data_referencia: string
          delivered_at?: string | null
          despesas?: Json
          destinatario_id?: string | null
          destinatario_nome?: string | null
          erro?: string | null
          erro_codigo?: string | null
          erro_detalhe?: Json | null
          erro_titulo?: string | null
          external_id?: string | null
          failed_at?: string | null
          http_status?: number | null
          id?: string
          mensagem?: string | null
          read_at?: string | null
          resposta_meta?: Json | null
          sent_at?: string | null
          status?: string
          status_atualizado_em?: string | null
          telefone?: string | null
          template_language?: string | null
          template_name?: string | null
          tentativas?: number
          tipo: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          data_obrigacao?: string | null
          data_referencia?: string
          delivered_at?: string | null
          despesas?: Json
          destinatario_id?: string | null
          destinatario_nome?: string | null
          erro?: string | null
          erro_codigo?: string | null
          erro_detalhe?: Json | null
          erro_titulo?: string | null
          external_id?: string | null
          failed_at?: string | null
          http_status?: number | null
          id?: string
          mensagem?: string | null
          read_at?: string | null
          resposta_meta?: Json | null
          sent_at?: string | null
          status?: string
          status_atualizado_em?: string | null
          telefone?: string | null
          template_language?: string | null
          template_name?: string | null
          tentativas?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_financeiros_log_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_destinatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendario_academico: {
        Row: {
          created_at: string
          data: string
          descricao: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao: string
          tipo: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          tipo?: string
        }
        Relationships: []
      }
      coordenadores: {
        Row: {
          created_at: string
          cursos: string[]
          id: string
          professor_id: string
          valor_quinzenal: number
        }
        Insert: {
          created_at?: string
          cursos?: string[]
          id?: string
          professor_id: string
          valor_quinzenal?: number
        }
        Update: {
          created_at?: string
          cursos?: string[]
          id?: string
          professor_id?: string
          valor_quinzenal?: number
        }
        Relationships: []
      }
      despesas_fixas: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          descricao: string | null
          dia_vencimento: number
          fornecedor: string | null
          id: string
          nome: string
          observacao: string | null
          recorrente: boolean
          tipo_valor: string
          updated_at: string
          updated_by: string | null
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          dia_vencimento: number
          fornecedor?: string | null
          id?: string
          nome: string
          observacao?: string | null
          recorrente?: boolean
          tipo_valor?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          descricao?: string | null
          dia_vencimento?: number
          fornecedor?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          recorrente?: boolean
          tipo_valor?: string
          updated_at?: string
          updated_by?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      despesas_ocorrencias: {
        Row: {
          competencia: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          despesa_id: string
          id: string
          observacao: string | null
          pago_por: string | null
          status: string
          updated_at: string
          valor_pago: number | null
          valor_previsto: number | null
        }
        Insert: {
          competencia: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          despesa_id: string
          id?: string
          observacao?: string | null
          pago_por?: string | null
          status?: string
          updated_at?: string
          valor_pago?: number | null
          valor_previsto?: number | null
        }
        Update: {
          competencia?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          despesa_id?: string
          id?: string
          observacao?: string | null
          pago_por?: string | null
          status?: string
          updated_at?: string
          valor_pago?: number | null
          valor_previsto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_ocorrencias_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "despesas_fixas"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_administrativas: {
        Row: {
          ativo: boolean
          created_at: string
          dias_semana: number[]
          entrada_prevista: string | null
          id: string
          intervalo_minutos: number
          nome: string
          retorno_intervalo_previsto: string | null
          saida_intervalo_prevista: string | null
          saida_prevista: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          entrada_prevista?: string | null
          id?: string
          intervalo_minutos?: number
          nome: string
          retorno_intervalo_previsto?: string | null
          saida_intervalo_prevista?: string | null
          saida_prevista?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          entrada_prevista?: string | null
          id?: string
          intervalo_minutos?: number
          nome?: string
          retorno_intervalo_previsto?: string | null
          saida_intervalo_prevista?: string | null
          saida_prevista?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exam_students: {
        Row: {
          created_at: string
          enrollment: string | null
          id: string
          name: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          enrollment?: string | null
          id?: string
          name: string
          turma_id: string
        }
        Update: {
          created_at?: string
          enrollment?: string | null
          id?: string
          name?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_students_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_submissions: {
        Row: {
          created_at: string
          exam_date: string
          file_path: string | null
          id: string
          materia_id: string
          mode: string
          professor_id: string
          questions: Json
          status: string
          title: string
          turma_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_date: string
          file_path?: string | null
          id?: string
          materia_id: string
          mode: string
          professor_id: string
          questions?: Json
          status?: string
          title: string
          turma_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_date?: string
          file_path?: string | null
          id?: string
          materia_id?: string
          mode?: string
          professor_id?: string
          questions?: Json
          status?: string
          title?: string
          turma_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_submissions_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_submissions_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_windows: {
        Row: {
          ends_on: string | null
          id: string
          model_instructions: string
          model_ready: boolean
          model_title: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          ends_on?: string | null
          id?: string
          model_instructions?: string
          model_ready?: boolean
          model_title?: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          ends_on?: string | null
          id?: string
          model_instructions?: string
          model_ready?: boolean
          model_title?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financeiro_audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      financeiro_config: {
        Row: {
          data: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      folha_administrativo_apoio: {
        Row: {
          adicionais: number
          atrasos: number
          created_at: string
          descontos: number
          dias_presentes: number
          dias_previstos: number
          faltas: number
          funcionario_id: string
          horas_extras: number
          id: string
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          saidas_antecipadas: number
          salario_quinzenal: number
          status: string
          updated_at: string
          valor_final: number
        }
        Insert: {
          adicionais?: number
          atrasos?: number
          created_at?: string
          descontos?: number
          dias_presentes?: number
          dias_previstos?: number
          faltas?: number
          funcionario_id: string
          horas_extras?: number
          id?: string
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          saidas_antecipadas?: number
          salario_quinzenal?: number
          status?: string
          updated_at?: string
          valor_final?: number
        }
        Update: {
          adicionais?: number
          atrasos?: number
          created_at?: string
          descontos?: number
          dias_presentes?: number
          dias_previstos?: number
          faltas?: number
          funcionario_id?: string
          horas_extras?: number
          id?: string
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          saidas_antecipadas?: number
          salario_quinzenal?: number
          status?: string
          updated_at?: string
          valor_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "folha_administrativo_apoio_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_administrativos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_administrativos: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          conta: string | null
          cpf: string | null
          created_at: string
          escala_id: string | null
          funcao_id: string | null
          id: string
          nome_completo: string
          observacoes: string | null
          pin: string | null
          pix: string | null
          salario_quinzenal: number
          tipo_conta: string | null
          tipo_funcionario: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          escala_id?: string | null
          funcao_id?: string | null
          id?: string
          nome_completo: string
          observacoes?: string | null
          pin?: string | null
          pix?: string | null
          salario_quinzenal?: number
          tipo_conta?: string | null
          tipo_funcionario?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          escala_id?: string | null
          funcao_id?: string | null
          id?: string
          nome_completo?: string
          observacoes?: string | null
          pin?: string | null
          pix?: string | null
          salario_quinzenal?: number
          tipo_conta?: string | null
          tipo_funcionario?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_administrativos_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas_administrativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_administrativos_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes_administrativas"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes_administrativas: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      generated_class_records: {
        Row: {
          generated_at: string
          generated_by: string | null
          horario_id: number | null
          hours_quantity: number
          id: string
          materia_id: string | null
          notes: string | null
          professor_id: string
          registro_ponto_id: string | null
          source_date: string
          source_title: string | null
          source_type: string
          turma_id: string | null
          vinculo_processamento: string | null
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          horario_id?: number | null
          hours_quantity?: number
          id?: string
          materia_id?: string | null
          notes?: string | null
          professor_id: string
          registro_ponto_id?: string | null
          source_date: string
          source_title?: string | null
          source_type: string
          turma_id?: string | null
          vinculo_processamento?: string | null
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          horario_id?: number | null
          hours_quantity?: number
          id?: string
          materia_id?: string | null
          notes?: string | null
          professor_id?: string
          registro_ponto_id?: string | null
          source_date?: string
          source_title?: string | null
          source_type?: string
          turma_id?: string | null
          vinculo_processamento?: string | null
        }
        Relationships: []
      }
      horarios_aula: {
        Row: {
          created_at: string
          dia_semana: number
          horario_id: number
          id: string
          materia_id: string
          professor_id: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          horario_id: number
          id?: string
          materia_id: string
          professor_id: string
          turma_id: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          horario_id?: number
          id?: string
          materia_id?: string
          professor_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_aula_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_aula_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_aula_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      materia_juncoes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          materia_ids: string[]
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          materia_ids?: string[]
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          materia_ids?: string[]
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      materias: {
        Row: {
          carga_horaria_total: number | null
          created_at: string | null
          curso_id: string
          horas_fixas_quinzenais: number
          id: string
          nome: string
          pagamento_fim: string | null
          pagamento_inicio: string | null
          pagamento_tipo: string
          turno: string | null
          valor_fixo_semestral: number
        }
        Insert: {
          carga_horaria_total?: number | null
          created_at?: string | null
          curso_id: string
          horas_fixas_quinzenais?: number
          id?: string
          nome: string
          pagamento_fim?: string | null
          pagamento_inicio?: string | null
          pagamento_tipo?: string
          turno?: string | null
          valor_fixo_semestral?: number
        }
        Update: {
          carga_horaria_total?: number | null
          created_at?: string | null
          curso_id?: string
          horas_fixas_quinzenais?: number
          id?: string
          nome?: string
          pagamento_fim?: string | null
          pagamento_inicio?: string | null
          pagamento_tipo?: string
          turno?: string | null
          valor_fixo_semestral?: number
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          destino_role: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          professor_id: string | null
          tipo: string
          titulo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          destino_role?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          professor_id?: string | null
          tipo: string
          titulo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          destino_role?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          professor_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payroll_adjustment_audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      permutas: {
        Row: {
          aceito_b_em: string | null
          aprovado_admin_em: string | null
          aprovado_por: string | null
          created_at: string
          data_a: string
          data_b: string
          horarios_a: number[]
          horarios_b: number[]
          id: string
          materia_a_id: string
          materia_b_id: string
          motivo_rejeicao: string | null
          observacao: string | null
          professor_a_id: string
          professor_b_id: string
          registro_a_id: string | null
          registro_b_id: string | null
          status: string
          turma_a_id: string
          turma_b_id: string
          updated_at: string
        }
        Insert: {
          aceito_b_em?: string | null
          aprovado_admin_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          data_a: string
          data_b: string
          horarios_a: number[]
          horarios_b: number[]
          id?: string
          materia_a_id: string
          materia_b_id: string
          motivo_rejeicao?: string | null
          observacao?: string | null
          professor_a_id: string
          professor_b_id: string
          registro_a_id?: string | null
          registro_b_id?: string | null
          status?: string
          turma_a_id: string
          turma_b_id: string
          updated_at?: string
        }
        Update: {
          aceito_b_em?: string | null
          aprovado_admin_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          data_a?: string
          data_b?: string
          horarios_a?: number[]
          horarios_b?: number[]
          id?: string
          materia_a_id?: string
          materia_b_id?: string
          motivo_rejeicao?: string | null
          observacao?: string | null
          professor_a_id?: string
          professor_b_id?: string
          registro_a_id?: string | null
          registro_b_id?: string | null
          status?: string
          turma_a_id?: string
          turma_b_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      professor_materias: {
        Row: {
          id: string
          materia_id: string
          professor_id: string
        }
        Insert: {
          id?: string
          materia_id: string
          professor_id: string
        }
        Update: {
          id?: string
          materia_id?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_materias_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_materias_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
        ]
      }
      professores: {
        Row: {
          agencia_bb: string | null
          chave_pix: string | null
          conta_bb: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string
          pin: string | null
          status: string | null
          telefone: string | null
          valor_hora_aula: number | null
        }
        Insert: {
          agencia_bb?: string | null
          chave_pix?: string | null
          conta_bb?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          pin?: string | null
          status?: string | null
          telefone?: string | null
          valor_hora_aula?: number | null
        }
        Update: {
          agencia_bb?: string | null
          chave_pix?: string | null
          conta_bb?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          pin?: string | null
          status?: string | null
          telefone?: string | null
          valor_hora_aula?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          professor_id: string | null
          role: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          professor_id?: string | null
          role?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          professor_id?: string | null
          role?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      registros_ponto: {
        Row: {
          anexo_url: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          carga_horaria: number
          competencia_pagamento: string | null
          created_at: string | null
          data: string
          gerado_em: string | null
          gerado_por: string | null
          horarios: number[]
          id: string
          justificativa: string | null
          latitude: number | null
          longitude: number | null
          materia_id: string
          motivo_rejeicao: string | null
          observacao: string | null
          origem: string | null
          professor_id: string
          professor_substituido_id: string | null
          quantidade_horarios: number
          retroativo: boolean
          status_aprovacao: string
          substituicao: boolean
          tipo_registro: string | null
          turma_id: string
          updated_at: string | null
          valor_total: number
          vinculo_processamento: string | null
        }
        Insert: {
          anexo_url?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          carga_horaria: number
          competencia_pagamento?: string | null
          created_at?: string | null
          data: string
          gerado_em?: string | null
          gerado_por?: string | null
          horarios: number[]
          id?: string
          justificativa?: string | null
          latitude?: number | null
          longitude?: number | null
          materia_id: string
          motivo_rejeicao?: string | null
          observacao?: string | null
          origem?: string | null
          professor_id: string
          professor_substituido_id?: string | null
          quantidade_horarios: number
          retroativo?: boolean
          status_aprovacao?: string
          substituicao?: boolean
          tipo_registro?: string | null
          turma_id: string
          updated_at?: string | null
          valor_total: number
          vinculo_processamento?: string | null
        }
        Update: {
          anexo_url?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          carga_horaria?: number
          competencia_pagamento?: string | null
          created_at?: string | null
          data?: string
          gerado_em?: string | null
          gerado_por?: string | null
          horarios?: number[]
          id?: string
          justificativa?: string | null
          latitude?: number | null
          longitude?: number | null
          materia_id?: string
          motivo_rejeicao?: string | null
          observacao?: string | null
          origem?: string | null
          professor_id?: string
          professor_substituido_id?: string | null
          quantidade_horarios?: number
          retroativo?: boolean
          status_aprovacao?: string
          substituicao?: boolean
          tipo_registro?: string | null
          turma_id?: string
          updated_at?: string | null
          valor_total?: number
          vinculo_processamento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ponto_administrativo: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string
          data: string
          diferenca_minutos: number | null
          funcionario_id: string
          horario_previsto: string | null
          horario_real: string
          id: string
          justificativa: string | null
          justificativa_retroativa: string | null
          latitude: number | null
          longitude: number | null
          motivo_rejeicao: string | null
          retroativo: boolean
          status: string | null
          status_aprovacao: string
          tipo_marcacao: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          data: string
          diferenca_minutos?: number | null
          funcionario_id: string
          horario_previsto?: string | null
          horario_real?: string
          id?: string
          justificativa?: string | null
          justificativa_retroativa?: string | null
          latitude?: number | null
          longitude?: number | null
          motivo_rejeicao?: string | null
          retroativo?: boolean
          status?: string | null
          status_aprovacao?: string
          tipo_marcacao: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string
          data?: string
          diferenca_minutos?: number | null
          funcionario_id?: string
          horario_previsto?: string | null
          horario_real?: string
          id?: string
          justificativa?: string | null
          justificativa_retroativa?: string | null
          latitude?: number | null
          longitude?: number | null
          motivo_rejeicao?: string | null
          retroativo?: boolean
          status?: string | null
          status_aprovacao?: string
          tipo_marcacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_administrativo_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_administrativos"
            referencedColumns: ["id"]
          },
        ]
      }
      robo_cron_token: {
        Row: {
          created_at: string
          id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          token?: string
        }
        Relationships: []
      }
      turma_juncoes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          turma_ids: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          turma_ids?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          turma_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      turma_materias: {
        Row: {
          id: string
          materia_id: string
          turma_id: string
        }
        Insert: {
          id?: string
          materia_id: string
          turma_id: string
        }
        Update: {
          id?: string
          materia_id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turma_materias_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turma_materias_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          created_at: string | null
          curso_id: string
          id: string
          nome: string
          periodo: string | null
          turno: string | null
        }
        Insert: {
          created_at?: string | null
          curso_id: string
          id?: string
          nome: string
          periodo?: string | null
          turno?: string | null
        }
        Update: {
          created_at?: string | null
          curso_id?: string
          id?: string
          nome?: string
          periodo?: string | null
          turno?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_destinatarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          identificacao: string | null
          nome: string
          receber_alertas: boolean
          telefone: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          identificacao?: string | null
          nome: string
          receber_alertas?: boolean
          telefone: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          identificacao?: string | null
          nome?: string
          receber_alertas?: boolean
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _coord_validate: {
        Args: { p_pin: string; p_prof_id: string }
        Returns: string[]
      }
      _func_adm_validate: {
        Args: { p_id: string; p_pin: string }
        Returns: boolean
      }
      _haversine_m: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      _minutos_pagamento_hora_aula: { Args: never; Returns: number }
      _minutos_por_horario: { Args: never; Returns: number }
      _prof_validate: {
        Args: { p_pin: string; p_prof_id: string }
        Returns: boolean
      }
      _robo_financeiro_tick: { Args: never; Returns: undefined }
      aprovar_ponto_admin: {
        Args: { p_acao: string; p_id: string; p_motivo?: string }
        Returns: Json
      }
      bater_ponto_admin: {
        Args: {
          p_func_id: string
          p_justificativa?: string
          p_lat?: number
          p_lng?: number
          p_pin: string
          p_tipo: string
        }
        Returns: Json
      }
      bater_ponto_admin_retroativo: {
        Args: {
          p_data: string
          p_func_id: string
          p_hora: string
          p_justificativa: string
          p_lat?: number
          p_lng?: number
          p_pin: string
          p_tipo: string
        }
        Returns: Json
      }
      cancelar_ajuste: {
        Args: { p_id: string; p_motivo: string }
        Returns: Json
      }
      coord_aprovar_registro: {
        Args: {
          p_acao: string
          p_motivo: string
          p_pin: string
          p_prof_id: string
          p_registro_id: string
        }
        Returns: Json
      }
      coord_grade: {
        Args: { p_pin: string; p_prof_id: string }
        Returns: {
          curso_id: string
          dia_semana: number
          horario_id: number
          id: string
          materia_id: string
          materia_nome: string
          professor_id: string
          professor_nome: string
          turma_id: string
          turma_nome: string
        }[]
      }
      coord_horario_delete: {
        Args: { p_id: string; p_pin: string; p_prof_id: string }
        Returns: Json
      }
      coord_horario_upsert: {
        Args: {
          p_dia_semana: number
          p_horario_id: number
          p_id: string
          p_materia_id: string
          p_pin: string
          p_prof_id: string
          p_professor_id: string
          p_turma_id: string
        }
        Returns: Json
      }
      coord_pendentes: {
        Args: { p_pin: string; p_prof_id: string }
        Returns: {
          anexo_url: string
          carga_horaria: number
          created_at: string
          curso_id: string
          data: string
          horarios: number[]
          id: string
          justificativa: string
          materia_nome: string
          professor_id: string
          professor_nome: string
          turma_nome: string
          valor_total: number
        }[]
      }
      coord_professor_update: {
        Args: {
          p_chave_pix: string
          p_email: string
          p_nome: string
          p_pin: string
          p_prof_id: string
          p_target_id: string
          p_telefone: string
          p_valor_hora: number
        }
        Returns: Json
      }
      coord_professores: {
        Args: { p_pin: string; p_prof_id: string }
        Returns: {
          chave_pix: string
          cpf: string
          cursos: string[]
          email: string
          id: string
          nome: string
          status: string
          telefone: string
          valor_hora_aula: number
        }[]
      }
      coord_registros_periodo: {
        Args: {
          p_end: string
          p_pin: string
          p_prof_id: string
          p_start: string
        }
        Returns: {
          anexo_url: string
          carga_horaria: number
          chave_pix: string
          cpf: string
          created_at: string
          curso_id: string
          data: string
          horarios: number[]
          id: string
          justificativa: string
          materia_id: string
          materia_nome: string
          motivo_rejeicao: string
          observacao: string
          professor_id: string
          professor_nome: string
          quantidade_horarios: number
          retroativo: boolean
          status_aprovacao: string
          turma_id: string
          turma_nome: string
          valor_hora: number
          valor_total: number
        }[]
      }
      coordenador_login: {
        Args: { p_nome: string; p_pin: string }
        Returns: Json
      }
      despesa_marcar_pago: {
        Args: {
          p_data?: string
          p_observacao?: string
          p_ocorrencia_id: string
          p_valor?: number
        }
        Returns: Json
      }
      despesa_reabrir: {
        Args: { p_motivo?: string; p_ocorrencia_id: string }
        Returns: Json
      }
      despesas_gerar_ocorrencias: {
        Args: { p_competencia?: string }
        Returns: Json
      }
      escala_admin_detalhe: {
        Args: { p_escala_id: string }
        Returns: {
          dias_semana: number[]
          entrada_prevista: string
          id: string
          intervalo_minutos: number
          nome: string
          retorno_intervalo_previsto: string
          saida_intervalo_prevista: string
          saida_prevista: string
        }[]
      }
      exam_teacher_save: {
        Args: {
          p_exam_date: string
          p_id: string
          p_materia_id: string
          p_mode: string
          p_pin: string
          p_prof_id: string
          p_questions: Json
          p_submit?: boolean
          p_title: string
          p_turma_id: string
        }
        Returns: string
      }
      exam_teacher_workspace: {
        Args: { p_pin: string; p_prof_id: string }
        Returns: Json
      }
      gerar_folha_admin: {
        Args: {
          p_funcionario_id?: string
          p_periodo_fim: string
          p_periodo_inicio: string
        }
        Returns: Json
      }
      get_historico_professor: {
        Args: { limite?: number; prof_id: string }
        Returns: {
          carga_horaria: number
          created_at: string
          data: string
          horarios: number[]
          id: string
          materia_id: string
          observacao: string
          professor_id: string
          quantidade_horarios: number
          retroativo: boolean
          status_aprovacao: string
          substituicao: boolean
          turma_id: string
          valor_total: number
        }[]
      }
      get_historico_professor_seguro: {
        Args: { p_limite?: number; p_pin: string; p_prof_id: string }
        Returns: {
          carga_horaria: number
          created_at: string
          data: string
          horarios: number[]
          id: string
          materia_id: string
          observacao: string
          professor_id: string
          quantidade_horarios: number
          retroativo: boolean
          status_aprovacao: string
          substituicao: boolean
          turma_id: string
          valor_total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      historico_ponto_admin: {
        Args: { p_func_id: string; p_limite?: number; p_pin: string }
        Returns: {
          data: string
          diferenca_minutos: number
          horario_previsto: string
          horario_real: string
          id: string
          justificativa: string
          status: string
          tipo_marcacao: string
        }[]
      }
      is_dia_letivo: { Args: { d: string }; Returns: boolean }
      lancar_hora_aula_extra: {
        Args: {
          p_competencia_origem: string
          p_competencia_pagamento: string
          p_data: string
          p_horarios: number[]
          p_materia_id: string
          p_motivo: string
          p_observacao: string
          p_professor_id: string
          p_tipo?: string
          p_turma_id: string
        }
        Returns: Json
      }
      list_funcionarios_admin_ativos: {
        Args: never
        Returns: {
          escala_id: string
          funcao_nome: string
          id: string
          nome_completo: string
          tipo_funcionario: string
        }[]
      }
      list_professores_ativos: {
        Args: never
        Returns: {
          id: string
          nome: string
          valor_hora_aula: number
        }[]
      }
      listar_registros_admin_full: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: {
          created_at: string
          data: string
          diferenca_minutos: number
          funcao_nome: string
          funcionario_id: string
          funcionario_nome: string
          horario_previsto: string
          horario_real: string
          id: string
          justificativa: string
          latitude: number
          longitude: number
          motivo_rejeicao: string
          retroativo: boolean
          status: string
          status_aprovacao: string
          tipo_marcacao: string
        }[]
      }
      notificacao_professor_excluir: {
        Args: { p_notificacao_id: string; p_pin: string; p_prof_id: string }
        Returns: Json
      }
      notificacao_professor_marcar_lida: {
        Args: { p_notificacao_id: string; p_pin: string; p_prof_id: string }
        Returns: Json
      }
      notificacoes_professor_excluir_todas: {
        Args: { p_ids: string[]; p_pin: string; p_prof_id: string }
        Returns: Json
      }
      notificacoes_professor_listar: {
        Args: { p_limite?: number; p_pin: string; p_prof_id: string }
        Returns: {
          created_at: string
          destino_role: string
          id: string
          lida: boolean
          link: string
          mensagem: string
          professor_id: string
          tipo: string
          titulo: string
        }[]
      }
      notificacoes_professor_marcar_todas_lidas: {
        Args: { p_ids: string[]; p_pin: string; p_prof_id: string }
        Returns: Json
      }
      permuta_aprovar: {
        Args: { p_acao: string; p_motivo: string; p_permuta_id: string }
        Returns: Json
      }
      permuta_listar: {
        Args: { p_pin: string; p_prof_id: string }
        Returns: {
          created_at: string
          data_a: string
          data_b: string
          horarios_a: number[]
          horarios_b: number[]
          id: string
          materia_a_nome: string
          materia_b_nome: string
          motivo_rejeicao: string
          observacao: string
          professor_a_id: string
          professor_a_nome: string
          professor_b_id: string
          professor_b_nome: string
          status: string
          turma_a_nome: string
          turma_b_nome: string
        }[]
      }
      permuta_responder: {
        Args: {
          p_aceitar: boolean
          p_motivo: string
          p_permuta_id: string
          p_pin: string
          p_prof_b_id: string
        }
        Returns: Json
      }
      permuta_solicitar: {
        Args: {
          p_data_a: string
          p_data_b: string
          p_horarios_a: number[]
          p_horarios_b: number[]
          p_materia_a_id: string
          p_materia_b_id: string
          p_observacao: string
          p_pin: string
          p_prof_a_id: string
          p_prof_b_id: string
          p_turma_a_id: string
          p_turma_b_id: string
        }
        Returns: Json
      }
      processar_data_gerar: {
        Args: {
          p_data: string
          p_origem: string
          p_scope_id?: string
          p_scope_type?: string
          p_tipo: string
          p_titulo: string
        }
        Returns: Json
      }
      processar_data_preview: {
        Args: { p_data: string; p_scope_id?: string; p_scope_type?: string }
        Returns: {
          curso_id: string
          dia_semana: number
          horario_id: number
          ja_existe: boolean
          materia_id: string
          materia_nome: string
          professor_id: string
          professor_nome: string
          turma_id: string
          turma_nome: string
        }[]
      }
      push_subscribe_professor: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_p256dh: string
          p_pin: string
          p_prof_id: string
          p_user_agent?: string
        }
        Returns: Json
      }
      recalcular_ajustes_pagamento: {
        Args: { p_minutos_pagamento?: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
