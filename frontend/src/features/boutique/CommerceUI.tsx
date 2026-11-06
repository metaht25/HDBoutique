import type { ReactNode } from 'react'
import { Icon } from '../../shared/ui/Icon'
import type { IconName } from '../../shared/ui/Icon'
import ui from './Commerce.module.css'

export function CommerceIntro({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: ReactNode }) {
  return <div className={ui.intro}><div className={ui.introCopy}><span className={ui.icon}><Icon name={icon} size={23} /></span><div><h2>{title}</h2><p>{description}</p></div></div>{action}</div>
}
export function CommerceSection({ title, description, children, number }: { title: string; description?: string; children: ReactNode; number?: string }) {
  return <section className={ui.section}><div className={ui.sectionHeading}><h3>{number && <span>{number}</span>}{title}</h3>{description && <p>{description}</p>}</div>{children}</section>
}
export function CommerceTable({ label, children }: { label: string; children: ReactNode }) {
  return <div className={ui.table} role="region" aria-label={label} tabIndex={0}><table><caption className={ui.srOnly}>{label}</caption>{children}</table></div>
}
export function CommerceEmpty({ title, children, loading = false, action }: { title: string; children?: ReactNode; loading?: boolean; action?: ReactNode }) {
  return <div className={ui.empty} role={loading ? 'status' : undefined}><Icon name={loading ? 'history' : 'products'} size={30} /><h3>{title}</h3>{children && <p>{children}</p>}{loading && <div className={ui.loading} aria-hidden="true" />}{action}</div>
}
