import { cn } from "@/lib/utils";

const BLADES = 12;

type SpinnerProps = {
  className?: string;
  size?: number;
};

/**
 * Compact Geist-style spinner for inline operational waits.
 * Prefer ProcessingIndicator when a visible label is available.
 */
function Spinner({ className, size = 14 }: SpinnerProps) {
  return (
    <span
      data-slot="spinner"
      className={cn("wwatch-spinner", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {Array.from({ length: BLADES }, (_, index) => (
        <span
          key={index}
          className="wwatch-spinner-blade"
          style={{
            transform: `rotate(${index * (360 / BLADES)}deg) translateY(-37%)`,
            animationDelay: `${(-BLADES + index) * (1.2 / BLADES)}s`,
          }}
        />
      ))}
    </span>
  );
}

export { Spinner };
