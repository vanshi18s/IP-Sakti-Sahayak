// Botanical texture. Soft, blurred, low opacity — reads as paper grain, never as a shape.
export default function LeafWatermarks({ tone = "light" }) {
  const stroke = tone === "dark" ? "#ffffff" : "#1b4332";
  const op = tone === "dark" ? 0.055 : 0.05;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden [filter:blur(0.4px)]" aria-hidden="true">
      {/* One drawn sprig, outlined not filled, bleeding off the top-right corner */}
      <svg className="absolute -right-20 -top-24 w-[30rem] h-[30rem] rotate-[18deg]" viewBox="0 0 200 200"
           fill="none" stroke={stroke} strokeOpacity={op * 2.2} strokeWidth="1.1" strokeLinecap="round">
        <path d="M100 190V26" />
        <path d="M100 150c-26 0-44-16-48-40 26-4 44 12 48 40zM100 150c26 0 44-16 48-40-26-4-44 12-48 40z" />
        <path d="M100 108c-21 0-36-13-39-33 21-3 36 10 39 33zM100 108c21 0 36-13 39-33-21-3-36 10-39 33z" />
        <path d="M100 70c-16 0-28-10-30-26 16-2 28 8 30 26zM100 70c16 0 28-10 30-26-16-2-28 8-30 26z" />
      </svg>

      {/* A second, quieter sprig at the lower left */}
      <svg className="absolute -left-24 -bottom-28 w-[26rem] h-[26rem] -rotate-[15deg]" viewBox="0 0 200 200"
           fill="none" stroke={stroke} strokeOpacity={op * 1.5} strokeWidth="1.1" strokeLinecap="round">
        <path d="M100 190V40" />
        <path d="M100 152c-24 0-41-15-45-37 24-4 41 11 45 37zM100 152c24 0 41-15 45-37-24-4-41 11-45 37z" />
        <path d="M100 112c-19 0-33-12-36-30 19-3 33 9 36 30zM100 112c19 0 33-12 36-30-19-3-33 9-36 30z" />
      </svg>
    </div>
  );
}
