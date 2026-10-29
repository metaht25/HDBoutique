import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => { cleanup() })
Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true })
