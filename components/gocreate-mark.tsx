export default function GoCreateMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="GoCreate Insight Studio">
      <svg viewBox="0 0 52 52" className={compact ? "h-8 w-8" : "h-10 w-10"} aria-hidden="true">
        <path d="M26 3 38 10 26 17 14 10Z" fill="var(--brand-yellow)" />
        <path d="M38 10 48 17 36 24 26 17Z" fill="var(--brand-blue)" />
        <path d="M36 24 48 31 36 38 26 31Z" fill="var(--brand-ink)" />
        <path d="M26 31 36 38 26 45 14 38Z" fill="var(--brand-yellow)" opacity=".88" />
        <path d="M14 24 26 31 14 38 4 31Z" fill="var(--brand-blue)" opacity=".78" />
        <path d="M14 10 26 17 14 24 4 17Z" fill="var(--brand-ink)" opacity=".75" />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div className="text-[17px] font-black tracking-[-0.045em]"><span className="text-[var(--brand-blue)]">GO</span><span className="text-white">CREATE</span></div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/45">Insight Studio</div>
        </div>
      )}
    </div>
  );
}
