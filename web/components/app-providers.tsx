import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delay={400}>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}
