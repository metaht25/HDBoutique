import { useEffect, useState } from 'react'

type Resource<T> = { key: string; data: T; error?: never } | { key: string; error: unknown; data?: never }

/** Ignore previous reads after query changes or unmount; writes never auto-retry. */
export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [resource, setResource] = useState<Resource<T> | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    void load(controller.signal).then(data => {
      if (active) setResource({ key, data })
    }).catch(error => {
      if (active) setResource({ key, error })
    })
    return () => { active = false; controller.abort() }
  }, [key, load])
  return resource?.key === key ? resource : null
}
