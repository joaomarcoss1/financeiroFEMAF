
REVOKE EXECUTE ON FUNCTION public.processar_data_preview(date,text,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.processar_data_gerar(date,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lancar_hora_aula_extra(uuid,uuid,uuid,date,integer[],text,date,date,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_ajuste(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._minutos_por_horario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_data_preview(date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_data_gerar(date,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lancar_hora_aula_extra(uuid,uuid,uuid,date,integer[],text,date,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_ajuste(uuid,text) TO authenticated;
