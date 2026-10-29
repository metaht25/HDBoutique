import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Card } from '../../src/shared/ui/Card'
import { LoadingState, Message } from '../../src/shared/ui/Feedback'
import { Pagination } from '../../src/shared/ui/Pagination'
import { TableContainer } from '../../src/shared/ui/TableContainer'
import { TextField } from '../../src/shared/ui/TextField'

it('announces loading and messages, rendering backend text without HTML execution', () => {
  render(<><LoadingState>Cargando datos</LoadingState>
    <Message>{'<img src=x onerror=alert(1)>'}</Message></>)
  expect(screen.getByRole('status').textContent).toBe('Cargando datos')
  expect(screen.getByRole('alert').textContent).toBe('<img src=x onerror=alert(1)>')
  expect(document.querySelector('img')).toBeNull()
})

it('links field labels, existing hints and validation errors to the input', () => {
  render(<><p id="hint">Dos decimales</p><TextField label="Precio" aria-describedby="hint"
    error="Precio requerido" /></>)
  const field = screen.getByRole('textbox', { name: 'Precio' })
  const descriptions = field.getAttribute('aria-describedby')?.split(' ') ?? []
  expect(descriptions.map(id => document.getElementById(id)?.textContent))
    .toEqual(['Dos decimales', 'Precio requerido'])
  expect(field.getAttribute('aria-invalid')).toBe('true')
})

function PaginatedExample() {
  const [page, setPage] = useState(1)
  return <Pagination page={page} pageCount={2} onPageChange={setPage} />
}
it('disables pagination boundaries and announces the page change', async () => {
  render(<PaginatedExample />)
  const previous = screen.getByRole<HTMLButtonElement>('button', { name: 'Anterior' })
  const next = screen.getByRole<HTMLButtonElement>('button', { name: 'Siguiente' })
  expect(previous.disabled).toBe(true)
  await userEvent.setup().click(next)
  expect(screen.getByText('Página 2 de 2').getAttribute('aria-live')).toBe('polite')
  expect(next.disabled).toBe(true)
  expect(previous.disabled).toBe(false)
})

it('keeps shared tables keyboard-scrollable with a named region and semantic headers', () => {
  render(<><Card label="Ventas">2</Card><TableContainer label="Ventas recientes">
    <table><thead><tr><th>Importe</th></tr></thead><tbody><tr><td>399.00</td></tr></tbody></table>
  </TableContainer></>)
  expect(screen.getByRole('region', { name: 'Ventas recientes' }).tabIndex).toBe(0)
  expect(screen.getByRole('columnheader').textContent).toBe('Importe')
  expect(screen.getByText('Ventas').parentElement?.textContent).toBe('Ventas2')
})
