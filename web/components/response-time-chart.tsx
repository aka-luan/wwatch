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
  const width = 360;
  const height = 100;
  const paddingLeft = 32;
  const paddingRight = 12;
  const paddingTop = 12;
  const paddingBottom = 16;

  const minLatency = 200;
  const maxLatency = 1600;

  // Calculate points
  const points = data.map((d, index) => {
    const x = paddingLeft + (index / (data.length - 1)) * (width - paddingLeft - paddingRight);
    const normalizedY = Math.max(0, Math.min(1, (d.latencyMs - minLatency) / (maxLatency - minLatency)));
    const y = height - paddingBottom - normalizedY * (height - paddingTop - paddingBottom);
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
    ? `${pathD} L ${lastPoint.x},${height - paddingBottom} L ${firstPoint.x},${height - paddingBottom} Z`
    : "";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border border-white/8 bg-[#0F1218] p-4 shadow-xl overflow-hidden",
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

      {/* Sparkline Chart with Y-axis */}
      <div className="relative mt-2 h-[105px] w-full">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-[18px] flex flex-col justify-between font-mono text-[9px] text-muted-foreground/60 select-none pointer-events-none">
          <span>1.5s</span>
          <span>1s</span>
          <span>500ms</span>
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF4D22" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FF4D22" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FF4D22" />
              <stop offset="70%" stopColor="#FF6842" />
              <stop offset="100%" stopColor="#FF4D22" />
            </linearGradient>
          </defs>

          {/* Faint horizontal guide lines */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={width - paddingRight}
            y2={paddingTop}
            stroke="rgba(255,255,255,0.03)"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingLeft}
            y1={(paddingTop + (height - paddingBottom)) / 2}
            x2={width - paddingRight}
            y2={(paddingTop + (height - paddingBottom)) / 2}
            stroke="rgba(255,255,255,0.03)"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="rgba(255,255,255,0.05)"
          />

          {/* Area Fill */}
          <path d={areaD} fill="url(#areaGradient)" />

          {/* Line Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#strokeGradient)"
            strokeWidth="2"
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
                    fill="#FF4D22"
                    className="animate-ping opacity-60"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="3.5"
                    fill="#FFFFFF"
                    stroke="#FF4D22"
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
              r="12"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>
      </div>

      {/* Time Axis Labels */}
      <div className="mt-1 ml-7 flex items-center justify-between font-mono text-[10px] text-muted-foreground/70 select-none">
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
