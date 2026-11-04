import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { TextField } from '../../src/shared/ui/TextField'
import { PartyForm } from '../../src/features/boutique/PartyForm'
import type { Employee } from '../../src/features/boutique/contracts'

it('rejects letters, exponents and excess money decimals while permitting clearing', async () => {
  function Fields() {
    const [money, setMoney] = useState(''), [quantity, setQuantity] = useState('')
    return <><TextField label="Costo" inputMode="decimal" value={money} onChange={e => setMoney(e.target.value)} /><TextField label="Cantidad" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} /></>
  }
  render(<Fields />); const user = userEvent.setup(), cost = screen.getByLabelText('Costo'), quantity = screen.getByLabelText('Cantidad')
  await user.type(cost, '12.34e5'); expect((cost as HTMLInputElement).value).toBe('12.34')
  await user.clear(cost); await user.type(cost, '0.01'); expect((cost as HTMLInputElement).value).toBe('0.01')
  await user.type(quantity, '-1e2a'); expect((quantity as HTMLInputElement).value).toBe('12')
  await user.clear(quantity); expect((quantity as HTMLInputElement).value).toBe('')
})

it('shows the immutable historical job title', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
  const row = { employee_id: 1, first_names: 'Prueba', last_names: 'Sintética', job_title: 'Cargo antiguo', phone_number: '80000000' } as Employee
  render(<PartyForm kind="employees" row={row} onSaved={vi.fn()} onClose={vi.fn()} />)
  const field = screen.getByRole('textbox', { name: 'Cargo' }) as HTMLInputElement
  expect(field.value).toBe('Cargo antiguo')
  expect(field.readOnly).toBe(true)
  expect(screen.queryByRole('combobox', { name: 'Cargo' })).toBeNull()
})

it('blocks letters in customer phones and keeps addresses textual', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json([])))
  render(<PartyForm kind="customers" initialKind="delivery" onDraft={vi.fn()} onSaved={vi.fn()} onClose={vi.fn()} />)
  const user = userEvent.setup(), phone = screen.getByLabelText('Teléfono') as HTMLInputElement
  await user.type(phone, 'abc81234567'); expect(phone.value).toBe('8123-4567')
  const address = screen.getByLabelText('Dirección exacta') as HTMLInputElement
  await user.type(address, 'Milagro de Dios, casa 4'); expect(address.value).toBe('Milagro de Dios, casa 4')
})
