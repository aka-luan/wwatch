import { useState } from "react";
import { getResponseTimeHistory, type LatencyPoint } from "@/lib/telemetry";
import { cn } from "@/lib/utils";

export function ResponseTimeChart({
  avgMs = 512,
  className,
}: {
  avgMs?: number;
  className?: string;
}) {
  const data = getResponseTimeHistory();
  const [hoveredPoint, setHoveredPoint] = useState<LatencyPoint | null>(null);

  // SVG dimensions
  const width = 320;
  const height = 90;
  const paddingX = 10;
  const paddingY = 14;

  const minLatency = 300;
  const maxLatency = 1600;

  // Calculate points
  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * (width - 2 * paddingX);
    const normalizedY = (d.latencyMs - minLatency) / (maxLatency - minLatency);
    const y = height - paddingY - normalizedY * (height - 2 * paddingY);
    return { ...d, x, y };
  });

  // Construct smooth bezier curve path
  const pathD = points.reduce((acc, point, index, arr) => {
    if (index === 0) return `M ${point.x},${point.y}`;
    const prev = arr[index - 1];
    if (!prev) return acc;
    const cx = (prev.x + point.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${point.y} ${point.x},${point.y}`;
  }, "");

  // Construct closed area path for gradient fill
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaD = firstPoint && lastPoint
    ? `${pathD} L ${lastPoint.x},${height} L ${firstPoint.x},${height} Z`
    : "";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border border-border/80 bg-card p-4 shadow-xl overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          RESPONSE TIME (AVG)
        </span>
        <span className="font-mono text-sm font-bold text-foreground">
          {hoveredPoint ? `${hoveredPoint.latencyMs}ms` : `${avgMs}ms`}
        </span>
      </div>

      {/* SVG Sparkline Chart */}
      <div className="relative mt-2 h-[95px] w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="70%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill="url(#areaGradient)" />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#strokeGradient)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Peak Indicator Dot */}
          {points.map((p, idx) => {
            if (p.isPeak) {
              return (
                <g key={idx}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="#f97316"
                    className="animate-ping opacity-60"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="3.5"
                    fill="#ffffff"
                    stroke="#f97316"
                    strokeWidth="2"
                  />
                </g>
              );
            }
            return null;
          })}

          {/* Interactive Hover Hit Zones */}
          {points.map((p, idx) => (
            <circle
              key={`hit-${idx}`}
              cx={p.x}
              cy={p.y}
              r="10"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>
      </div>

      {/* Time Axis Labels */}
      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground/80">
        <span>12:00</span>
        <span>16:00</span>
        <span>20:00</span>
        <span>00:00</span>
        <span>04:00</span>
        <span>08:00</span>
      </div>
    </div>
  );
}
