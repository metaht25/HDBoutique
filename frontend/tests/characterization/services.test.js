import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as products from '../../src/services/productosService.js'
import * as customers from '../../src/services/clientesService.js'
import * as suppliers from '../../src/services/proveedoresService.js'
import * as purchases from '../../src/services/comprasService.js'
import * as sales from '../../src/services/ventasService.js'
import * as dashboard from '../../src/services/dashboardService.js'
import * as reports from '../../src/services/reportesService.js'

const contracts = JSON.parse(readFileSync(new URL(
  '../../../backend/tests/characterization/fixtures/legacy_contracts.json',
  import.meta.url,
), 'utf8')).resources

function exampleFor(path) {
  const contract = contracts.find((item) => item.path === path)
  assert.ok(contract, `Missing synthetic contract for ${path}`)
  return contract.example
}

const readCases = [
  [products.obtenerProductos, '/api/productos/productos/'],
  [products.obtenerCategorias, '/api/productos/categorias/'],
  [products.obtenerTallas, '/api/productos/tallas/'],
  [customers.obtenerClientes, '/api/personas/clientes/'],
  [customers.obtenerTiposClientes, '/api/personas/tipos-clientes/'],
  [customers.obtenerDepartamentos, '/api/departamentos/'],
  [customers.obtenerMunicipios, '/api/municipios/'],
  [suppliers.obtenerProveedores, '/api/proveedores/proveedores/'],
  [purchases.obtenerCompras, '/api/compras/compras/'],
  [purchases.obtenerDetallesCompras, '/api/compras/detalles-compras/'],
  [purchases.obtenerProveedoresCompras, '/api/proveedores/proveedores/'],
  [purchases.obtenerEmpleadosCompras, '/api/personas/empleados/'],
  [purchases.obtenerProductosProveedoresCompras, '/api/proveedores/productos-proveedores/'],
  [purchases.obtenerProductosCompras, '/api/productos/productos/'],
  [sales.obtenerVentas, '/api/ventas/ventas/'],
  [sales.obtenerDetallesVentas, '/api/ventas/detalles-ventas/'],
  [sales.obtenerClientesVentas, '/api/personas/clientes/'],
  [sales.obtenerEmpleadosVentas, '/api/personas/empleados/'],
  [sales.obtenerProductosVentas, '/api/productos/productos/'],
  [dashboard.obtenerProductosDashboard, '/api/productos/productos/'],
  [dashboard.obtenerClientesDashboard, '/api/personas/clientes/'],
  [dashboard.obtenerVentasDashboard, '/api/ventas/ventas/'],
  [dashboard.obtenerComprasDashboard, '/api/compras/compras/'],
  [dashboard.obtenerProveedoresDashboard, '/api/proveedores/proveedores/'],
  [reports.obtenerProductosReportes, '/api/productos/productos/'],
  [reports.obtenerClientesReportes, '/api/personas/clientes/'],
  [reports.obtenerTiposClientesReportes, '/api/personas/tipos-clientes/'],
  [reports.obtenerVentasReportes, '/api/ventas/ventas/'],
  [reports.obtenerComprasReportes, '/api/compras/compras/'],
  [reports.obtenerProveedoresReportes, '/api/proveedores/proveedores/'],
]

const writeCases = [
  [products.crearProducto, '/api/productos/productos/', 'POST'],
  [products.actualizarProducto, '/api/productos/productos/', 'PATCH'],
  [customers.crearCliente, '/api/personas/clientes/', 'POST'],
  [customers.actualizarCliente, '/api/personas/clientes/', 'PATCH'],
  [customers.crearDireccion, '/api/direcciones/', 'POST'],
  [sales.crearVenta, '/api/ventas/ventas/', 'POST'],
  [sales.crearDetalleVenta, '/api/ventas/detalles-ventas/', 'POST'],
]

for (const [request, path] of readCases) {
  test(`${request.name}: GET existing path and preserve response values`, async (context) => {
    const responseBody = [exampleFor(path)]
    const fetchMock = context.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => responseBody,
    }))

    assert.deepEqual(await request(), responseBody)
    assert.equal(fetchMock.mock.callCount(), 1)
    const [url, options] = fetchMock.mock.calls[0].arguments
    assert.equal(url, path)
    assert.equal(options?.method ?? 'GET', 'GET')
  })
}

for (const [request, path, method] of writeCases) {
  test(`${request.name}: ${method} JSON and preserve server response`, async (context) => {
    const contract = contracts.find((item) => item.path === path)
    const responseBody = exampleFor(path)
    const { [contract.primary_key]: ignoredId, ...payload } = responseBody
    assert.ok(ignoredId)
    const fetchMock = context.mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => responseBody,
    }))

    const actual = method === 'PATCH'
      ? await request(ignoredId, payload)
      : await request(payload)

    assert.deepEqual(actual, responseBody)
    assert.equal(fetchMock.mock.callCount(), 1)
    const [url, options] = fetchMock.mock.calls[0].arguments
    assert.equal(url, method === 'PATCH' ? `${path}${ignoredId}/` : path)
    assert.equal(options.method, method)
    assert.equal(options.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(options.body), payload)
  })
}

test('existing services reject unsuccessful HTTP responses before reading JSON', async (context) => {
  let jsonCalls = 0
  context.mock.method(globalThis, 'fetch', async () => ({
    ok: false,
    status: 400,
    json: async () => {
      jsonCalls += 1
      return { detail: 'Synthetic rejection' }
    },
  }))

  for (const [request] of readCases) {
    await assert.rejects(() => request(), Error)
  }
  for (const [request, path, method] of writeCases) {
    const payload = exampleFor(path)
    await assert.rejects(
      () => method === 'PATCH' ? request(101, payload) : request(payload),
      Error,
    )
  }
  assert.equal(jsonCalls, 0)
})

test('network failures are propagated to callers', async (context) => {
  const failure = new TypeError('Synthetic offline connection')
  context.mock.method(globalThis, 'fetch', async () => { throw failure })

  for (const [request] of readCases) {
    await assert.rejects(() => request(), (error) => error === failure)
  }
  for (const [request, path, method] of writeCases) {
    await assert.rejects(
      () => method === 'PATCH' ? request(101, exampleFor(path)) : request(exampleFor(path)),
      (error) => error === failure,
    )
  }
})

test('paginated envelopes are passed through without unwrapping results', async (context) => {
  const page = {
    count: 2,
    next: '/api/productos/productos/?page=2',
    previous: null,
    results: [exampleFor('/api/productos/productos/')],
  }
  context.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => page }))
  assert.deepEqual(await products.obtenerProductos(), page)
})

test('debt resource constant keeps its existing path', () => {
  assert.equal(customers.DEUDAS_CLIENTES_URL, '/api/personas/deudas-clientes/')
})
