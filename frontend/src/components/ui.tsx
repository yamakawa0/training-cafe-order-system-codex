import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function AppHeader({
  title,
  subtitle,
  meta,
  actions
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="appHeader">
      <div>
        <p className="brand">カフェ・ルポ / Cafe Repos</p>
        {subtitle && <p className="eyebrow">{subtitle}</p>}
        <h1>{title}</h1>
      </div>
      {(meta || actions) && (
        <div className="headerActions">
          {meta}
          {actions}
        </div>
      )}
    </section>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`statusPill status-${status}`}>{status}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="emptyState">{children}</div>;
}

export function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: Tone }) {
  return <div className={`banner ${tone}`}>{children}</div>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="sectionTitle">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export function SummaryCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <article className="summaryCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export function TerminalIndicator({ label, status }: { label: string; status?: string }) {
  return (
    <div className="terminalIndicator">
      <span>{label}</span>
      {status && <StatusPill status={status} />}
    </div>
  );
}
