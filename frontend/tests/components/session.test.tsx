import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../src/features/session/SessionProvider'
import { SessionStatus } from '../../src/features/session/SessionStatus'
import { useSession } from '../../src/features/session/sessionContext'
import { apiClient } from '../../src/shared/api/client'

const account = { user_id: 1, username: 'synthetic-manager', role: 'Manager', is_active: true, employee_id: null }
function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}
beforeEach(() => { apiClient.clearCsrf() })

it('deduplicates restore under StrictMode and gets CSRF for an existing session', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json(account))
    .mockResolvedValueOnce(json({ csrf_token: 'synthetic-token' }))
  vi.stubGlobal('fetch', fetchMock)
  render(<StrictMode><SessionProvider><SessionStatus /></SessionProvider></StrictMode>)
  await screen.findByText('synthetic-manager · Gerencia')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('distinguishes unavailable session from anonymous and permits retry', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json({ error: { code: 'database_unavailable', message: 'Sesión no disponible temporalmente' } }, 503))
    .mockResolvedValueOnce(json({ error: { code: 'authentication_required', message: 'No session' } }, 401))
  vi.stubGlobal('fetch', fetchMock)
  render(<SessionProvider><SessionStatus /></SessionProvider>)
  await screen.findByText('Sesión no disponible temporalmente')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar sesión' }))
  await screen.findByText('Sin sesión')
  expect(screen.queryByText('Sesión no disponible temporalmente')).toBeNull()
})

it('does not display a malformed or inactive account as authenticated', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...account, is_active: false })))
  render(<SessionProvider><SessionStatus /></SessionProvider>)
  await screen.findByText('Respuesta de sesión no válida.')
  expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull()
})

it('sends CSRF on logout, handles 204 and clears the displayed user', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json(account))
    .mockResolvedValueOnce(json({ csrf_token: 'logout-csrf' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  render(<SessionProvider><SessionStatus /></SessionProvider>)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
  await screen.findByText('Sin sesión')
  expect(fetchMock.mock.calls[2]?.[1].headers['X-CSRF-Token']).toBe('logout-csrf')
})

it('keeps the session visible after a failed logout and shows the backend error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(account))
    .mockResolvedValueOnce(json({ csrf_token: 'logout-csrf' }))
    .mockResolvedValueOnce(json({ error: { code: 'database_unavailable', message: 'Inténtalo de nuevo' } }, 503)))
  render(<SessionProvider><SessionStatus /></SessionProvider>)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
  await screen.findByRole('alert')
  expect(screen.getByText('synthetic-manager · Gerencia')).toBeDefined()
  expect(screen.getByRole('alert').textContent).toContain('Inténtalo de nuevo')
})

it('clears the header after a versioned request reports expiry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(account))
    .mockResolvedValueOnce(json({ csrf_token: 'token' }))
    .mockResolvedValueOnce(json({ error: { code: 'authentication_required', message: 'Expired' } }, 401)))
  render(<SessionProvider><SessionStatus /></SessionProvider>)
  await screen.findByText('synthetic-manager · Gerencia')
  await act(async () => { await apiClient.request('/api/v1/products').catch(() => undefined) })
  await screen.findByText('Sin sesión')
})

function LoginConsumer() {
  const { login } = useSession()
  return <button onClick={() => void login('synthetic-manager', 'Synthetic-password-27!')}>Test login</button>
}

it('provides login for the next screen phase and uses the rotated CSRF for logout', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json({}, 401))
    .mockResolvedValueOnce(json({ csrf_token: 'preauth' }))
    .mockResolvedValueOnce(json(account, 200, { 'X-CSRF-Token': 'rotated' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  render(<SessionProvider><LoginConsumer /><SessionStatus /></SessionProvider>)
  await screen.findByText('Sin sesión')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Test login' }))
  await screen.findByText('synthetic-manager · Gerencia')
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
  expect(fetchMock.mock.calls[3]?.[1].headers['X-CSRF-Token']).toBe('rotated')
  expect(window.localStorage.length).toBe(0)
  expect(window.sessionStorage.length).toBe(0)
})

it('does not replace a newer login with a late restore response', async () => {
  let releaseRestore: (response: Response) => void = () => undefined
  const oldRestore = new Promise<Response>(resolve => { releaseRestore = resolve })
  const fetchMock = vi.fn().mockReturnValueOnce(oldRestore)
    .mockResolvedValueOnce(json({ csrf_token: 'preauth' }))
    .mockResolvedValueOnce(json({ ...account, username: 'new-session' }))
    .mockResolvedValueOnce(json({ csrf_token: 'restored-token' }))
  vi.stubGlobal('fetch', fetchMock)
  render(<SessionProvider><LoginConsumer /><SessionStatus /></SessionProvider>)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Test login' }))
  await screen.findByText('new-session · Gerencia')
  await act(async () => { releaseRestore(json(account)); await oldRestore })
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
  expect(screen.queryByText('synthetic-manager · Gerencia')).toBeNull()
  expect(screen.getByText('new-session · Gerencia')).toBeDefined()
})
