# Project architecture
- Keep payroll computation in a shared pure utility, so unified and teaching exports use the same installment and cent-rounding rules.
- Model indefinite recurring subject payments as fixo_quinzenal with fixed hours and a per-half-month amount in valor_fixo_semestral; keep semester installment contracts unchanged to preserve their historical calculations.
- Treat payroll exports as read-only views of payment data; never mutate historical records when correcting presentation totals.
- Keep historical exam API references isolated from generated Cloud types until their schema is available, because those legacy endpoints are absent from the current database.
- Read teacher point history only through the PIN-validated RPC, because the former public history endpoint exposed private attendance records.