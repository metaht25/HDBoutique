import { useState } from 'react'
import { Message } from '../../shared/ui/Feedback'
import styles from './CashRegisterPage.module.css'

const CAJA_INICIAL = {
  montoInicial: '',
  empleado: '',
  fechaHora: '',
  efectivoContado: '',
  ventasRegistradas: '',
  observaciones: '',
}

function obtenerNumero(valor) {
  const numero = Number(valor || 0)

  return Number.isNaN(numero) ? 0 : numero
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
  }).format(valor)
}

function obtenerFechaHoraActual() {
  const fecha = new Date()
  const zonaLocal = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000)

  return zonaLocal.toISOString().slice(0, 16)
}

function Caja() {
  const [caja, setCaja] = useState({
    ...CAJA_INICIAL,
    fechaHora: obtenerFechaHoraActual(),
  })
  const [cajaAbierta, setCajaAbierta] = useState(false)

  const montoInicial = obtenerNumero(caja.montoInicial)
  const efectivoContado = obtenerNumero(caja.efectivoContado)
  const ventasRegistradas = obtenerNumero(caja.ventasRegistradas)
  const diferencia = efectivoContado - ventasRegistradas - montoInicial

  function actualizarCaja(event) {
    const { name, value } = event.target

    setCaja((cajaActual) => ({
      ...cajaActual,
      [name]: value,
    }))
  }

  function abrirCaja(event) {
    event.preventDefault()
    setCajaAbierta(true)
  }

  function cerrarCaja(event) {
    event.preventDefault()
    setCajaAbierta(false)
  }

  function reiniciarCaja() {
    setCaja({
      ...CAJA_INICIAL,
      fechaHora: obtenerFechaHoraActual(),
    })
    setCajaAbierta(false)
  }

  return (
    <div className="caja-page">
      <div className="caja-header">
        <div>
          <h2>Caja</h2>
          <p>Apertura y cierre de caja preparados para conectar al backend.</p>
        </div>
      </div>

      <div className="caja-resumen">
        <div className={`resumen-card estado ${cajaAbierta ? 'abierta' : 'cerrada'}`}>
          <span>Estado de caja</span>
          <strong>{cajaAbierta ? 'Abierta' : 'Cerrada'}</strong>
        </div>

        <div className="resumen-card">
          <span>Monto inicial</span>
          <strong>{formatearMoneda(montoInicial)}</strong>
        </div>

        <div className="resumen-card">
          <span>Total ventas del dia</span>
          <strong>{formatearMoneda(ventasRegistradas)}</strong>
        </div>

        <div className={`resumen-card ${diferencia !== 0 ? 'alerta' : ''}`}>
          <span>Diferencia</span>
          <strong>{formatearMoneda(diferencia)}</strong>
        </div>
      </div>

      <div className="caja-grid">
        <form className="caja-panel" onSubmit={abrirCaja}>
          <div className="caja-panel-header">
            <h3>Apertura de caja</h3>
            <span>Datos iniciales del turno.</span>
          </div>

          <div className="caja-form-grid">
            <label>
              <span>Monto inicial</span>
              <input
                min="0"
                name="montoInicial"
                step="0.01"
                type="number"
                value={caja.montoInicial}
                onChange={actualizarCaja}
              />
            </label>

            <label>
              <span>Empleado/Cajero</span>
              <input
                name="empleado"
                type="text"
                value={caja.empleado}
                onChange={actualizarCaja}
              />
            </label>

            <label>
              <span>Fecha y hora</span>
              <input
                name="fechaHora"
                type="datetime-local"
                value={caja.fechaHora}
                onChange={actualizarCaja}
              />
            </label>
          </div>

          <div className="caja-actions">
            <button type="submit">Abrir caja</button>
            <button className="button-secundario" type="button" onClick={reiniciarCaja}>
              Reiniciar
            </button>
          </div>
        </form>

        <form className="caja-panel" onSubmit={cerrarCaja}>
          <div className="caja-panel-header">
            <h3>Cierre de caja</h3>
            <span>Conteo final y observaciones.</span>
          </div>

          <div className="caja-form-grid">
            <label>
              <span>Efectivo contado</span>
              <input
                min="0"
                name="efectivoContado"
                step="0.01"
                type="number"
                value={caja.efectivoContado}
                onChange={actualizarCaja}
              />
            </label>

            <label>
              <span>Ventas registradas</span>
              <input
                min="0"
                name="ventasRegistradas"
                step="0.01"
                type="number"
                value={caja.ventasRegistradas}
                onChange={actualizarCaja}
              />
            </label>

            <label>
              <span>Diferencia</span>
              <input readOnly value={formatearMoneda(diferencia)} />
            </label>

            <label className="observaciones-field">
              <span>Observaciones</span>
              <textarea
                name="observaciones"
                rows="4"
                value={caja.observaciones}
                onChange={actualizarCaja}
              />
            </label>
          </div>

          <div className="caja-actions">
            <button type="submit">Cerrar caja</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CashRegisterPage() {
  return <div className={styles.scope}><Message variant="info">Prototipo de caja pendiente de reglas B10. Esta pantalla no registra ni concilia dinero.</Message><Caja /></div>
}
