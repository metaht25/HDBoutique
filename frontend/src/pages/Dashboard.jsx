import './Dashboard.css'

function Dashboard() {
  return (
    <div className="dashboard">
      <h2>Resumen general</h2>

      <div className="cards">
        <div className="card">
          <h3>Ventas del día</h3>
          <p>C$ 0.00</p>
        </div>

        <div className="card">
          <h3>Ventas del mes</h3>
          <p>C$ 0.00</p>
        </div>

        <div className="card">
          <h3>Saldo por cobrar</h3>
          <p>C$ 0.00</p>
        </div>

        <div className="card">
          <h3>Clientes con mora</h3>
          <p>0</p>
        </div>

        <div className="card">
          <h3>Productos bajo mínimo</h3>
          <p>0</p>
        </div>

        <div className="card">
          <h3>Compras pendientes</h3>
          <p>0</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard