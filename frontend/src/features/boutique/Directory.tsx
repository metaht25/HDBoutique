import type { PartyKind } from './party'
import Suppliers from './Suppliers'
import Customers from './Customers'
import Employees from './Employees'

export default function Directory({ kind }: { kind: PartyKind }) {
  return kind === 'suppliers' ? <Suppliers /> : kind === 'customers' ? <Customers /> : <Employees />
}
