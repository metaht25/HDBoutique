import { Component } from 'react'
import type { ReactNode } from 'react'
import { Message } from '../shared/ui/Feedback'

export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <Message>No se pudo mostrar la pantalla.
      <button type="button" onClick={() => window.location.reload()}>Recargar</button>
    </Message> : this.props.children
  }
}
