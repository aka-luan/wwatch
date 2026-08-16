import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/lib/theme";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <TooltipProvider delay={400}>
      {children}
      <Toaster theme={theme} />
    </TooltipProvider>
  );
}
