import Image from "next/image";

export default function GoCreateMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="gc-brand" aria-label="GoCreate Insights">
      <Image
        src="/brand/gocreate/H_GoCreate_Blue_Black_Yellow.svg"
        width={compact ? 118 : 166}
        height={compact ? 34 : 48}
        priority
        className={compact ? "gc-official-logo compact" : "gc-official-logo"}
        alt="GoCreate"
      />
      {!compact && <span className="gc-insights-label">Insights</span>}
    </div>
  );
}
