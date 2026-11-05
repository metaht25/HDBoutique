import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { App } from '../../src/app/App'
import { SessionProvider } from '../../src/features/session/SessionProvider'
import { PartyForm } from '../../src/features/boutique/PartyForm'
import { apiClient } from '../../src/shared/api/client'

it('presents a real authentication rejection in Spanish and clears the password', async () => {
  apiClient.clearCsrf()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/csrf')
    ? Response.json({ csrf_token: 'synthetic-csrf' })
    : Response.json({ error: { code: 'invalid_credentials', message: 'Invalid credentials' } }, { status: 401 })))
  render(<MemoryRouter><SessionProvider><App /></SessionProvider></MemoryRouter>)
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Usuario'), 'synthetic-owner')
  await user.type(screen.getByLabelText('Contraseña'), 'synthetic-password')
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('El usuario o la contraseña no son correctos.'))
  expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('')
})

it('associates server validation with employee inputs, retains the form and clears corrected field errors', async () => {
  apiClient.clearCsrf()
  const saved = vi.fn(), calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const path = String(input).split('?')[0]
    if (path?.endsWith('/csrf')) return Response.json({ csrf_token: 'synthetic-csrf' })
    if (path?.endsWith('/departments')) return Response.json([{ department_id: 1, name: 'Synthetic department' }])
    if (path?.endsWith('/municipalities')) return Response.json([{ municipality_id: 1, department_id: 1, name: 'Synthetic municipality' }])
    if (options?.method === 'POST') calls.push(path ?? '')
    return Response.json({ error: { code: 'validation_error', message: 'Invalid request', fields: [
      { location: ['body', 'username'], type: 'string_pattern_mismatch' },
      { location: ['body', 'password'], type: 'string_too_short' },
    ] } }, { status: 422 })
  }))
  render(<PartyForm kind="employees" onSaved={saved} onClose={vi.fn()} />)
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Nombres'), 'Synthetic')
  await user.type(screen.getByLabelText('Apellidos'), 'Employee')
  await user.type(screen.getByLabelText('Teléfono'), '80000000')
  await user.type(screen.getByLabelText('Usuario de acceso'), 'bad username')
  await user.type(screen.getByLabelText('Contraseña'), 'synthetic-password')
  await user.click(await screen.findByRole('combobox', { name: 'Departamento' }))
  await user.click(await screen.findByRole('option', { name: 'Synthetic department' }))
  await user.click(screen.getByRole('combobox', { name: 'Municipio' }))
  await user.click(await screen.findByRole('option', { name: 'Synthetic municipality' }))
  await user.type(screen.getByLabelText('Dirección exacta'), 'Synthetic home')
  await user.click(screen.getByRole('button', { name: 'Guardar empleado' }))
  await waitFor(() => expect(screen.getByLabelText('Usuario de acceso').getAttribute('aria-invalid')).toBe('true'))
  const username = screen.getByLabelText('Usuario de acceso'), password = screen.getByLabelText('Contraseña')
  expect(screen.getByRole('alert').textContent).toContain('Usuario: Usa el formato indicado')
  expect(password.getAttribute('aria-invalid')).toBe('true')
  expect(document.getElementById(password.getAttribute('aria-describedby')!)?.textContent).toContain('longitud mínima')
  expect((password as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Nombres') as HTMLInputElement).value).toBe('Synthetic')
  expect(calls).toEqual(['/api/v1/employees']); expect(saved).not.toHaveBeenCalled()
  await user.clear(username)
  expect(username.getAttribute('aria-invalid')).toBe('false')
})
