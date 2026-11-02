import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { SearchSelect } from '../../src/features/boutique/SearchSelect'
import { AddressFields } from '../../src/features/boutique/PartyForm'
import { vi } from 'vitest'

function Example() {
  const [value, setValue] = useState('')
  return <SearchSelect label="Departamento" value={value} onChange={setValue} options={[{ id: 1, label: 'Managua' }, { id: 2, label: 'León' }]} />
}
it('filters accents, selects by keyboard and handles empty results and Escape', async () => {
  const user = userEvent.setup()
  render(<Example />)
  const input = screen.getByRole('combobox', { name: 'Departamento' })
  await user.type(input, 'LEON'); expect(screen.getAllByRole('option')).toHaveLength(1)
  await user.keyboard('{Enter}'); expect((input as HTMLInputElement).value).toBe('León'); expect(input.getAttribute('aria-expanded')).toBe('false')
  await user.clear(input); await user.type(input, 'missing'); expect(screen.getByText('Sin coincidencias')).not.toBeNull()
  await user.keyboard('{Escape}'); expect(input.getAttribute('aria-expanded')).toBe('false'); expect(document.activeElement).toBe(input)
})

it('clears municipality and filters options after successive department changes', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => Response.json(input.includes('/departments')
    ? [{ department_id: 1, name: 'Managua' }, { department_id: 2, name: 'León' }]
    : [{ municipality_id: 10, department_id: 1, name: 'Mateare' }, { municipality_id: 20, department_id: 2, name: 'Nagarote' }])))
  function Address() {
    const [values, setValues] = useState<Record<string, string>>({})
    return <AddressFields values={values} update={(field, value) => setValues(current => ({ ...current, [field]: value }))} required />
  }
  const user = userEvent.setup()
  render(<Address />)
  const department = await screen.findByRole('combobox', { name: 'Departamento' })
  await user.click(department); await user.click(screen.getByRole('option', { name: 'Managua' }))
  await user.click(screen.getByRole('combobox', { name: 'Municipio' }))
  expect(screen.queryByRole('option', { name: 'Nagarote' })).toBeNull()
  await user.click(screen.getByRole('option', { name: 'Mateare' }))
  await user.clear(department); await user.type(department, 'LEON'); await user.keyboard('{Enter}')
  const municipality = screen.getByRole('combobox', { name: 'Municipio' })
  expect((municipality as HTMLInputElement).value).toBe('')
  await user.click(municipality); await user.click(screen.getByRole('option', { name: 'Nagarote' }))
  await user.clear(department); await user.type(department, 'Managua'); await user.keyboard('{Enter}')
  expect((screen.getByRole('combobox', { name: 'Municipio' }) as HTMLInputElement).value).toBe('')
})
