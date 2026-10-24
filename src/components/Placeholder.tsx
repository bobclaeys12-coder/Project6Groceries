interface Props {
  icon: string
  title: string
  phase: string
  children?: React.ReactNode
}

/**
 * Tijdelijke inhoud voor pagina's die in een latere fase ingevuld worden.
 * De route, de navigatie en de koptekst werken al wel, zodat de schil in
 * fase 1 volledig te testen is.
 */
export default function Placeholder({ icon, title, phase, children }: Props) {
  return (
    <div className="card empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 style={{ margin: '0.5rem 0 0.25rem', color: 'var(--text)' }}>{title}</h2>
      <p className="small" style={{ marginBottom: 0 }}>
        Komt in {phase}.
      </p>
      {children && (
        <p className="small" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          {children}
        </p>
      )}
    </div>
  )
}
