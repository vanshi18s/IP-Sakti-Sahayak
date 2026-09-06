// Segmented control with a sliding indicator. Reused for the jurisdiction switch.
export default function Segmented({ options, value, onChange, labels = {} }) {
  const idx = Math.max(0, options.indexOf(value));
  const width = 100 / options.length;
  return (
    <div
      role="radiogroup"
      className="relative inline-grid bg-sage-deep/60 rounded-full p-1 select-none"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <div
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full bg-leaf shadow-sm transition-[left] duration-300 ease-out"
        style={{ left: `calc(${idx * width}% + 4px)`, width: `calc(${width}% - 8px)` }}
      />
      {options.map((o) => (
        <button
          key={o}
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`relative z-10 px-4 py-1.5 text-sm font-semibold rounded-full transition-colors duration-300 ${
            value === o ? "text-paper" : "text-leaf hover:text-leaf-soft"
          }`}
        >
          {labels[o] || o}
        </button>
      ))}
    </div>
  );
}
