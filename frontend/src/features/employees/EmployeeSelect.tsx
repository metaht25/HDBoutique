import { useCallback } from 'react'
import { useResource } from '../../shared/hooks/useResource'
import { SelectField } from '../../shared/ui/SelectField'
import { Message } from '../../shared/ui/Feedback'
import { employeeOptions } from './api'
export function EmployeeSelect({ label, value, disabled, onChange }: { label: string; value: string | number; disabled?: boolean; onChange: (value: string) => void }) {
  const load = useCallback((signal: AbortSignal) => employeeOptions(signal), [])
  const result = useResource('employee-options', load)
  const rows = result?.data ?? []
  return <div><SelectField label={label} value={value} disabled={disabled || !result || !!result.error} onChange={event => onChange(event.target.value)}>
    <option value="">Selecciona un empleado</option>
    {value && !rows.some(row => String(row.employee_id) === String(value)) && <option value={value}>Empleado #{value}</option>}
    {rows.map(row => <option key={row.employee_id} value={row.employee_id}>{row.first_names} {row.last_names} (#{row.employee_id})</option>)}
  </SelectField>{result?.error !== undefined && <Message>No se pudieron cargar los empleados. Recarga la pantalla para reintentar.</Message>}
    {result?.data?.length === 0 && <Message>No hay empleados registrados. Solicita su registro al personal autorizado.</Message>}</div>
}
