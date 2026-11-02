import { useState } from 'react'
import { CatalogPanel } from '../settings/CatalogPanel'
import { AccountsPanel } from '../settings/AccountsPanel'
import { catalogs } from '../settings/api'
import type { Catalog } from '../settings/api'
import { Modal } from './ui'
import styles from './Boutique.module.css'

export function ReferenceModal({ kind, onClose }: { kind: 'products' | 'locations' | 'accounts'; onClose: () => void }) {
  const choices: Catalog[] = kind === 'products' ? ['categories'] : ['departments', 'municipalities']
  const [selected, setSelected] = useState<Catalog>(choices[0]!)
  return <Modal title={kind === 'products' ? 'Catálogos de productos' : kind === 'locations' ? 'Departamentos y municipios' : 'Cuentas y accesos'} onClose={onClose} wide>
    {kind === 'accounts' ? <AccountsPanel /> : <><div className={styles.tabs}>{choices.map(key => <button key={key} className={selected === key ? '' : 'secondary'} onClick={() => setSelected(key)}>{catalogs[key].label}</button>)}</div><CatalogPanel key={selected} kind={selected} /></>}
  </Modal>
}
