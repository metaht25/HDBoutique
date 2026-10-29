import { TableContainer } from '../../shared/ui/TableContainer'
import { TextField } from '../../shared/ui/TextField'
import { LoadingState, Message } from '../../shared/ui/Feedback'
import { getErrorMessage } from '../../shared/api/errors'
import { useEffect, useState } from 'react'
import {
  actualizarProducto,
  crearProducto,
  obtenerCategorias,
  obtenerProductos,
  obtenerTallas,
} from './legacyApi.js'
import styles from './ProductsPage.module.css'

const STOCK_BAJO_LIMITE = 10
const PRODUCTO_INICIAL = {
  nombre: '',
  cantidadstock: '',
  stock: '',
  preciounitario: '',
  id_categoria: '',
  id_talla: '',
}
const ERRORES_INICIALES = {}

function obtenerListaProductos(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  return []
}

function obtenerStock(producto) {
  return Number(producto.cantidadstock ?? producto.stock ?? 0)
}

function obtenerIdProducto(producto) {
  return producto.id_producto ?? producto.id
}

function obtenerValorFormulario(valor) {
  return valor === null || valor === undefined ? '' : String(valor)
}

function productoEstaActivo(producto, estadosLocalesProductos) {
  const idProducto = obtenerIdProducto(producto)

  if (typeof estadosLocalesProductos[idProducto] === 'boolean') {
    return estadosLocalesProductos[idProducto]
  }

  if (typeof producto.activo === 'boolean') {
    return producto.activo
  }

  if (typeof producto.estado === 'string') {
    return producto.estado.toLowerCase() !== 'inactivo'
  }

  return true
}

function obtenerIdCategoria(categoria) {
  return categoria.id_categoria ?? categoria.id ?? ''
}

function obtenerNombreCategoria(categoria) {
  return categoria.nombre ?? categoria.categoria ?? categoria.descripcion ?? 'Categoria sin nombre'
}

function obtenerIdTalla(talla) {
  return talla.id_talla ?? talla.id ?? ''
}

function obtenerNombreTalla(talla) {
  return talla.nombre ?? talla.talla ?? talla.descripcion ?? 'Talla sin nombre'
}

function formatearPrecio(precio) {
  const valor = Number(precio ?? 0)

  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
  }).format(Number.isNaN(valor) ? 0 : valor)
}

function validarProducto(producto) {
  const errores = {}
  const nombre = producto.nombre.trim()
  const precioUnitario = Number(producto.preciounitario)
  const cantidadStock = Number(producto.cantidadstock)
  const stock = Number(producto.stock)

  if (!nombre) {
    errores.nombre = 'El nombre del producto es obligatorio.'
  }

  if (!producto.id_categoria) {
    errores.id_categoria = 'Selecciona una categoria.'
  }

  if (!producto.id_talla) {
    errores.id_talla = 'Selecciona una talla.'
  }

  if (producto.preciounitario === '') {
    errores.preciounitario = 'El precio unitario es obligatorio.'
  } else if (Number.isNaN(precioUnitario) || precioUnitario <= 0) {
    errores.preciounitario = 'El precio unitario debe ser mayor que 0.'
  }

  if (producto.cantidadstock === '') {
    errores.cantidadstock = 'La cantidad stock es obligatoria.'
  } else if (Number.isNaN(cantidadStock) || cantidadStock < 0) {
    errores.cantidadstock = 'La cantidad stock debe ser mayor o igual a 0.'
  }

  if (producto.stock === '') {
    errores.stock = 'El stock es obligatorio.'
  } else if (Number.isNaN(stock) || stock < 0) {
    errores.stock = 'El stock debe ser mayor o igual a 0.'
  }

  if (
    !errores.cantidadstock &&
    !errores.stock &&
    stock > cantidadStock
  ) {
    errores.stock = 'El stock no debe ser mayor que la cantidad stock.'
  }

  return errores
}

function Productos() {
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [categorias, setCategorias] = useState([])
  const [tallas, setTallas] = useState([])
  const [nuevoProducto, setNuevoProducto] = useState(PRODUCTO_INICIAL)
  const [guardando, setGuardando] = useState(false)
  const [mensajeFormulario, setMensajeFormulario] = useState('')
  const [errorFormulario, setErrorFormulario] = useState('')
  const [erroresFormulario, setErroresFormulario] = useState(ERRORES_INICIALES)
  const [productoEditandoId, setProductoEditandoId] = useState(null)
  const [estadosLocalesProductos, setEstadosLocalesProductos] = useState({})

  async function refrescarProductos() {
    const data = await obtenerProductos()
    setProductos(obtenerListaProductos(data))
    setError('')
  }

  useEffect(() => {
    async function cargarProductosIniciales() {
      try {
        const data = await obtenerProductos()
        setProductos(obtenerListaProductos(data))
        setError('')
      } catch (error) {

        setError(getErrorMessage(error, 'No se pudieron cargar los productos'))
      } finally {
        setCargando(false)
      }
    }

    cargarProductosIniciales()
  }, [])

  useEffect(() => {
    async function cargarOpcionesFormulario() {
      try {
        const [categoriasData, tallasData] = await Promise.all([
          obtenerCategorias(),
          obtenerTallas(),
        ])

        setCategorias(obtenerListaProductos(categoriasData))
        setTallas(obtenerListaProductos(tallasData))
      } catch (error) {

        setErrorFormulario(getErrorMessage(error, 'No se pudieron cargar las categorias o tallas'))
      }
    }

    cargarOpcionesFormulario()
  }, [])

  function actualizarNuevoProducto(event) {
    const { name, value } = event.target

    setNuevoProducto((productoActual) => ({
      ...productoActual,
      [name]: value,
    }))
    setErroresFormulario((erroresActuales) => ({
      ...erroresActuales,
      [name]: '',
    }))
  }

  function cancelarEdicion() {
    setProductoEditandoId(null)
    setNuevoProducto(PRODUCTO_INICIAL)
    setErroresFormulario(ERRORES_INICIALES)
    setMensajeFormulario('')
    setErrorFormulario('')
  }

  function editarProducto(producto) {
    setProductoEditandoId(obtenerIdProducto(producto))
    setNuevoProducto({
      nombre: obtenerValorFormulario(producto.nombre),
      cantidadstock: obtenerValorFormulario(producto.cantidadstock),
      stock: obtenerValorFormulario(producto.stock),
      preciounitario: obtenerValorFormulario(producto.preciounitario),
      id_categoria: obtenerValorFormulario(producto.id_categoria),
      id_talla: obtenerValorFormulario(producto.id_talla),
    })
    setErroresFormulario(ERRORES_INICIALES)
    setMensajeFormulario('')
    setErrorFormulario('')
  }

  function desactivarProducto(producto) {
    const confirmar = window.confirm(
      `¿Deseas desactivar el producto "${producto.nombre || 'Sin nombre'}"?`,
    )

    if (!confirmar) {
      return
    }

    const idProducto = obtenerIdProducto(producto)

    setEstadosLocalesProductos((productosActuales) => ({
      ...productosActuales,
      [idProducto]: false,
    }))

    if (productoEditandoId === idProducto) {
      cancelarEdicion()
    }
  }

  function activarProducto(producto) {
    const idProducto = obtenerIdProducto(producto)

    setEstadosLocalesProductos((productosActuales) => ({
      ...productosActuales,
      [idProducto]: true,
    }))
  }

  async function guardarProducto(event) {
    event.preventDefault()
    setMensajeFormulario('')
    setErrorFormulario('')

    const errores = validarProducto(nuevoProducto)

    if (Object.values(errores).some(Boolean)) {
      setErroresFormulario(errores)
      setErrorFormulario('Revisa los campos marcados antes de guardar.')
      return
    }

    setGuardando(true)
    setErroresFormulario(ERRORES_INICIALES)

    const datosProducto = {
      nombre: nuevoProducto.nombre.trim(),
      cantidadstock: Number(nuevoProducto.cantidadstock),
      stock: Number(nuevoProducto.stock),
      preciounitario: Number(nuevoProducto.preciounitario),
      id_categoria: Number(nuevoProducto.id_categoria),
      id_talla: Number(nuevoProducto.id_talla),
    }

    try {
      if (productoEditandoId !== null) {
        await actualizarProducto(productoEditandoId, datosProducto)
      } else {
        await crearProducto(datosProducto)
      }

      setNuevoProducto(PRODUCTO_INICIAL)
      setProductoEditandoId(null)
      setErroresFormulario(ERRORES_INICIALES)
      setMensajeFormulario(
        productoEditandoId !== null
          ? 'Producto actualizado correctamente'
          : 'Producto guardado correctamente',
      )
      await refrescarProductos()
    } catch (error) {

      setErrorFormulario(getErrorMessage(error, productoEditandoId !== null
          ? 'No se pudo actualizar el producto'
          : 'No se pudo guardar el producto'))
    } finally {
      setGuardando(false)
    }
  }

  const totalProductos = productos.length

  const totalStock = productos.reduce((acumulador, producto) => {
    return acumulador + obtenerStock(producto)
  }, 0)

  const productosBajoStock = productos.filter((producto) => {
    const stock = obtenerStock(producto)

    return stock > 0 && stock <= STOCK_BAJO_LIMITE
  }).length

  const terminoBusqueda = busqueda.trim().toLowerCase()
  const productosFiltrados = productos.filter((producto) => {
    const nombreCoincide = terminoBusqueda
      ? String(producto.nombre ?? '').toLowerCase().includes(terminoBusqueda)
      : true
    const activo = productoEstaActivo(producto, estadosLocalesProductos)
    const stock = obtenerStock(producto)
    const bajoStock = stock > 0 && stock <= STOCK_BAJO_LIMITE
    const disponible = stock > STOCK_BAJO_LIMITE
    const estadoCoincide =
      filtroEstado === 'todos' ||
      (filtroEstado === 'disponibles' && activo && disponible) ||
      (filtroEstado === 'bajo-stock' && activo && bajoStock) ||
      (filtroEstado === 'no-disponibles' && !activo)

    return nombreCoincide && estadoCoincide
  })

  if (cargando) {
    return (
      <div className="productos-page">
        <LoadingState>Cargando productos...</LoadingState>
      </div>
    )
  }

  if (error) {
    return (
      <div className="productos-page">
        <Message>{error}</Message>
      </div>
    )
  }

  return (
    <div className="productos-page">
      <div className="productos-header">
        <div>
          <h2>Productos e inventario</h2>
          <p>Listado general de productos registrados en inventario.</p>
        </div>
      </div>

      <form
        className={`producto-form ${productoEditandoId !== null ? 'editando' : ''}`}
        onSubmit={guardarProducto}
        noValidate
      >
        <div className="producto-form-header">
          <h3>{productoEditandoId !== null ? 'Editar producto' : 'Nuevo producto'}</h3>
          <span>
            {productoEditandoId !== null
              ? 'Actualiza los datos del producto seleccionado.'
              : 'Completa los datos para registrarlo en inventario.'}
          </span>
        </div>

        <div className="producto-form-grid">
          <TextField
              label="Nombre"
              error={erroresFormulario.nombre}
              className={erroresFormulario.nombre ? 'input-error' : ''}
              name="nombre"
              type="text"
              value={nuevoProducto.nombre}
              onChange={actualizarNuevoProducto}
          />

          <label>
            <span>Cantidad stock</span>
            <input
              className={erroresFormulario.cantidadstock ? 'input-error' : ''}
              min="0"
              name="cantidadstock"
              type="number"
              value={nuevoProducto.cantidadstock}
              onChange={actualizarNuevoProducto}
            />
            {erroresFormulario.cantidadstock && (
              <small className="field-error">{erroresFormulario.cantidadstock}</small>
            )}
          </label>

          <label>
            <span>Stock</span>
            <input
              className={erroresFormulario.stock ? 'input-error' : ''}
              min="0"
              name="stock"
              type="number"
              value={nuevoProducto.stock}
              onChange={actualizarNuevoProducto}
            />
            {erroresFormulario.stock && (
              <small className="field-error">{erroresFormulario.stock}</small>
            )}
          </label>

          <label>
            <span>Precio unitario</span>
            <input
              className={erroresFormulario.preciounitario ? 'input-error' : ''}
              min="0"
              name="preciounitario"
              step="0.01"
              type="number"
              value={nuevoProducto.preciounitario}
              onChange={actualizarNuevoProducto}
            />
            {erroresFormulario.preciounitario && (
              <small className="field-error">{erroresFormulario.preciounitario}</small>
            )}
          </label>

          <label>
            <span>Categoria</span>
            <select
              className={erroresFormulario.id_categoria ? 'input-error' : ''}
              name="id_categoria"
              value={nuevoProducto.id_categoria}
              onChange={actualizarNuevoProducto}
            >
              <option value="">Selecciona una categoria</option>
              {categorias.map((categoria) => {
                const idCategoria = obtenerIdCategoria(categoria)

                return (
                  <option key={idCategoria} value={idCategoria}>
                    {obtenerNombreCategoria(categoria)}
                  </option>
                )
              })}
            </select>
            {erroresFormulario.id_categoria && (
              <small className="field-error">{erroresFormulario.id_categoria}</small>
            )}
          </label>

          <label>
            <span>Talla</span>
            <select
              className={erroresFormulario.id_talla ? 'input-error' : ''}
              name="id_talla"
              value={nuevoProducto.id_talla}
              onChange={actualizarNuevoProducto}
            >
              <option value="">Selecciona una talla</option>
              {tallas.map((talla) => {
                const idTalla = obtenerIdTalla(talla)

                return (
                  <option key={idTalla} value={idTalla}>
                    {obtenerNombreTalla(talla)}
                  </option>
                )
              })}
            </select>
            {erroresFormulario.id_talla && (
              <small className="field-error">{erroresFormulario.id_talla}</small>
            )}
          </label>
        </div>

        <div className="producto-form-actions">
          <div>
            {mensajeFormulario && (
              <span className="form-message success">{mensajeFormulario}</span>
            )}
            {errorFormulario && (
              <span className="form-message error">{errorFormulario}</span>
            )}
          </div>

          <button type="submit" disabled={guardando}>
            {guardando
              ? 'Guardando...'
              : productoEditandoId !== null
                ? 'Actualizar producto'
                : 'Guardar producto'}
          </button>

          {productoEditandoId !== null && (
            <button className="button-secundario" type="button" onClick={cancelarEdicion}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="productos-toolbar">
        <label className="buscador-productos" htmlFor="buscar-productos">
          <span>Buscar producto</span>
          <input
            id="buscar-productos"
            type="search"
            placeholder="Nombre del producto"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </label>

        <div className="filtro-productos" aria-label="Filtrar productos por estado">
          <button
            className={filtroEstado === 'todos' ? 'activo' : ''}
            type="button"
            onClick={() => setFiltroEstado('todos')}
          >
            Todos
          </button>

          <button
            className={filtroEstado === 'disponibles' ? 'activo' : ''}
            type="button"
            onClick={() => setFiltroEstado('disponibles')}
          >
            Disponibles
          </button>

          <button
            className={filtroEstado === 'bajo-stock' ? 'activo' : ''}
            type="button"
            onClick={() => setFiltroEstado('bajo-stock')}
          >
            Bajo stock
          </button>

          <button
            className={filtroEstado === 'no-disponibles' ? 'activo' : ''}
            type="button"
            onClick={() => setFiltroEstado('no-disponibles')}
          >
            No disponibles
          </button>
        </div>
      </div>

      <div className="productos-resumen">
        <div className="resumen-card">
          <span>Total productos</span>
          <strong>{totalProductos}</strong>
        </div>

        <div className="resumen-card">
          <span>Stock total</span>
          <strong>{totalStock}</strong>
        </div>

        <div className="resumen-card alerta">
          <span>Productos bajo stock</span>
          <strong>{productosBajoStock}</strong>
        </div>
      </div>

      <div className="table-container">
        {productosFiltrados.length === 0 ? (
          <div className="productos-estado">
            {productos.length === 0
              ? 'No hay productos registrados.'
              : 'No se encontraron productos con esos filtros.'}
          </div>
        ) : (
          <TableContainer><table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>Precio unitario</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {productosFiltrados.map((producto) => {
                const activo = productoEstaActivo(producto, estadosLocalesProductos)
                const stock = obtenerStock(producto)
                const agotado = stock <= 0
                const bajoStock = stock > 0 && stock <= STOCK_BAJO_LIMITE
                const estadoClase = !activo
                  ? 'inactive'
                  : agotado
                    ? 'danger'
                    : bajoStock
                      ? 'warning'
                      : 'success'
                const estadoTexto = !activo
                  ? 'No disponible'
                  : agotado
                    ? 'Agotado'
                    : bajoStock
                      ? 'Bajo stock'
                      : 'Disponible'

                return (
                  <tr className={!activo ? 'producto-inactivo' : ''} key={obtenerIdProducto(producto)}>
                    <td>{obtenerIdProducto(producto)}</td>
                    <td className="producto-nombre">{producto.nombre || 'Sin nombre'}</td>
                    <td>{formatearPrecio(producto.preciounitario)}</td>
                    <td>{stock}</td>
                    <td>
                      <span className={`badge ${estadoClase}`}>
                        {estadoTexto}
                      </span>
                    </td>
                    <td>
                      <div className="acciones-producto">
                        <button type="button" onClick={() => editarProducto(producto)}>
                          Editar
                        </button>
                        {activo ? (
                          <button
                            className="danger"
                            type="button"
                            onClick={() => desactivarProducto(producto)}
                          >
                            Desactivar
                          </button>
                        ) : (
                          <button
                            className="success"
                            type="button"
                            onClick={() => activarProducto(producto)}
                          >
                            Activar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></TableContainer>
        )}
      </div>
    </div>
  )
}

export default function ProductsPage() {
  return <div className={styles.scope}><Productos /></div>
}
