import { useEffect, useRef } from "react";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value: string;
  onValueChange: (next: string) => void;
  placeholder?: string;
  label: string;
  /** Focus the field when this key is pressed outside a text field. */
  hotkey?: string;
  className?: string;
};

/**
 * Search field with a leading icon and a hotkey hint. The hotkey handler moved here
 * unchanged from SiteFilters, including the guards that keep it from firing while the
 * user is typing somewhere else or a dialog is open.
 */
export function SearchInput({
  value,
  onValueChange,
  placeholder = "Search",
  label,
  hotkey = "/",
  className,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hotkey) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== hotkey || event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }
      if (isTypingTarget(event.target) || isOverlayOpen()) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hotkey]);

  return (
    <div className={cn("relative min-w-[12rem] flex-1", className)}>
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="peer h-8 border-transparent bg-transparent pl-8 shadow-none hover:border-border focus-visible:border-ring md:pr-8 md:text-sm dark:bg-transparent"
      />
      {hotkey && !value ? (
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-sm border border-border px-1 font-mono text-[11px] text-muted-foreground peer-focus:hidden md:inline-flex">
          {hotkey}
        </kbd>
      ) : null}
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isOverlayOpen(): boolean {
  return Boolean(
    document.querySelector(
      '[data-slot="dialog-overlay"][data-open], [data-slot="sheet-overlay"][data-open], [data-slot="alert-dialog-overlay"][data-open]',
    ),
  );
}
