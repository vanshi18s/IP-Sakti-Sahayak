// One source citation, styled like a margin note in a statute book.
export default function SourceCard({ source, highlighted, onHover }) {
  const pct = Math.round((source.score || 0) * 100);
  return (
    <div
      id={`src-${source.id}`}
      onMouseEnter={() => onHover?.(source.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`relative border-l-4 pl-3 py-2 pr-2 bg-paper rounded-r-md transition-colors ${
        highlighted ? "border-saffron bg-saffron-soft" : "border-sage-deep"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-saffron text-xs">[{source.id}]</span>
        <span className="font-semibold text-sm text-ink">{source.doc}</span>
      </div>
      <div className="text-xs text-ink-soft mt-0.5">
        {source.section !== "n/a" && <span>{source.section} · </span>}
        <span>page {source.page}</span>
        <span> · {source.jurisdiction}</span>
        {source.version_date && source.version_date !== "unknown" && (
          <span> · version {source.version_date}</span>
        )}
      </div>
      <p className="text-xs text-ink-soft mt-1.5 leading-relaxed line-clamp-3">"{source.snippet}"</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-ink-soft">match {pct}%</span>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-leaf underline underline-offset-2"
          >
            Open official text
          </a>
        )}
      </div>
    </div>
  );
}
