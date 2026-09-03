import { useEffect, useState } from "react";

// Hand-built (no @aceternity/shadcn dependency — that CLI assumes a Next.js/TypeScript project
// and doesn't fit this plain Vite/JS app) but matches the behavior of Aceternity's
// background-ripple-effect: a grid of cells sitting behind the page; clicking one sends a ripple
// of opacity pulses outward, each cell's delay proportional to its distance from the click.
// Purely decorative chrome for AppShell's root wrapper — pointer-events only reach it wherever no
// real content (nav, cards, footer) is covering it. Row/col count is derived from the viewport
// (not a fixed prop) so the grid always tiles edge-to-edge and covers the full body, on any
// screen size, instead of a fixed-size block centered in the middle.
export function BackgroundRippleEffect({ cellSize = 56 }) {
  const [ripple, setRipple] = useState(null);
  const [grid, setGrid] = useState({ rows: 0, cols: 0 });

  useEffect(() => {
    function updateGrid() {
      setGrid({
        cols: Math.ceil(window.innerWidth / cellSize) + 1,
        rows: Math.ceil(window.innerHeight / cellSize) + 1,
      });
    }
    updateGrid();
    window.addEventListener("resize", updateGrid);
    return () => window.removeEventListener("resize", updateGrid);
  }, [cellSize]);

  function handleCellClick(row, col) {
    setRipple({ row, col, id: Date.now() });
  }

  const { rows, cols } = grid;
  if (!rows || !cols) return null;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 opacity-80 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,black_45%,transparent_85%)]">
        <div
          className="pointer-events-auto grid h-full w-full"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
        >
          {Array.from({ length: rows * cols }).map((_, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const isRippling = Boolean(ripple);
            const distance = ripple ? Math.hypot(row - ripple.row, col - ripple.col) : 0;

            return (
              <div
                key={ripple ? `${row}-${col}-${ripple.id}` : `${row}-${col}`}
                role="presentation"
                onClick={() => handleCellClick(row, col)}
                style={isRippling ? { "--delay": `${distance * 45}ms`, "--duration": "700ms" } : undefined}
                className={`cursor-pointer border border-white/15 bg-violet-500/[0.03] transition-colors duration-200 hover:bg-white/10 ${
                  isRippling ? "animate-cell-ripple bg-violet-500/40" : ""
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
