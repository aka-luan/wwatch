import { useEffect, useId, useState, type HTMLAttributes } from "react";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import {
  classifyConnectError,
  emptyAddSiteValues,
  validateAddSite,
  type AddSiteField,
  type AddSiteFieldErrors,
  type AddSiteValues,
} from "@/lib/add-site-form";
import { cn } from "@/lib/utils";

export function AddSiteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const formId = useId();
  const [values, setValues] = useState<AddSiteValues>(emptyAddSiteValues);
  const [fieldErrors, setFieldErrors] = useState<AddSiteFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (open) {
      return;
    }
    setValues(emptyAddSiteValues());
    setFieldErrors({});
    setFormError("");
    setBusy(false);
    setHelpOpen(false);
  }, [open]);

  function setField(key: keyof AddSiteValues, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === "origin" || key === "username" || key === "applicationPassword") {
      setFieldErrors((prev) => {
        if (!prev[key]) {
          return prev;
        }
        const next: AddSiteFieldErrors = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (formError) {
      setFormError("");
    }
  }

  async function connect() {
    if (busy) {
      return;
    }
    const nextErrors = validateAddSite(values);
    setFieldErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      const first = (["origin", "username", "applicationPassword"] as const).find((key) => nextErrors[key]);
      if (first) {
        document.getElementById(fieldId(formId, first))?.focus();
      }
      return;
    }

    setBusy(true);
    try {
      const site = await api<{ id: string }>("/api/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          origin: values.origin.trim(),
          username: values.username.trim(),
          applicationPassword: values.applicationPassword,
        }),
      });
      onOpenChange(false);
      await api(`/api/sites/${site.id}/scan`, { method: "POST" });
      toast.success("Scan started");
      await onCreated(site.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect.";
      const classified = classifyConnectError(message);
      if (classified.field) {
        setFieldErrors({ [classified.field]: classified.form });
        setFormError(classified.form);
        document.getElementById(fieldId(formId, classified.field))?.focus();
      } else {
        setFormError(classified.form);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(40rem,90dvh)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-[440px]",
        )}
        showCloseButton={false}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void connect();
          }}
        >
          <DialogHeader className="shrink-0 space-y-1.5 border-b border-border px-4 py-4 text-left">
            <DialogTitle>Add a WordPress site</DialogTitle>
            <DialogDescription>Connect using a WordPress Application Password.</DialogDescription>
            <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
              <CollapsibleTrigger
                type="button"
                className="group inline-flex items-center gap-1 rounded-md text-left text-[13px] text-ring hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                How do I create one?
                <ChevronDownIcon
                  className="size-3.5 shrink-0 transition-transform duration-150 group-aria-expanded:rotate-180"
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <ApplicationPasswordHelp />
              </CollapsibleContent>
            </Collapsible>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
            <Field
              formId={formId}
              name="name"
              label="Name"
              hint="Optional display name on the board"
              value={values.name}
              onChange={(value) => setField("name", value)}
              placeholder="Bakery"
              autoComplete="organization"
              autoFocus
              disabled={busy}
            />
            <Field
              formId={formId}
              name="origin"
              label="Site URL"
              value={values.origin}
              onChange={(value) => setField("origin", value)}
              placeholder="https://bakery.example"
              autoComplete="url"
              inputMode="url"
              error={fieldErrors.origin}
              disabled={busy}
              required
            />
            <Field
              formId={formId}
              name="username"
              label="WordPress username"
              hint="The account login, not the Application Password name"
              value={values.username}
              onChange={(value) => setField("username", value)}
              placeholder="admin"
              autoComplete="username"
              error={fieldErrors.username}
              disabled={busy}
              required
            />
            <Field
              formId={formId}
              name="applicationPassword"
              label="Application password"
              value={values.applicationPassword}
              onChange={(value) => setField("applicationPassword", value)}
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              autoComplete="current-password"
              type="password"
              error={fieldErrors.applicationPassword}
              disabled={busy}
              required
            />
            {formError ? (
              <p className="text-[13px] leading-5 text-destructive" role="alert" aria-live="assertive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 sm:justify-end">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? <Spinner size={14} /> : null}
              {busy ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationPasswordHelp() {
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 px-3 py-2.5 text-[13px] leading-5 text-muted-foreground ring-1 ring-border/70 ring-inset">
      <p>
        In WP Admin open <span className="text-foreground">Users → Profile → Application Passwords</span>.
      </p>
      <p>Create one on an administrator account when you want updates and fixes from the board.</p>
      <p>
        <span className="text-foreground">Username</span> is that account&apos;s WordPress login.{" "}
        <span className="text-foreground">Application password</span> is the generated password WordPress
        shows once.
      </p>
    </div>
  );
}

function Field({
  formId,
  name,
  label,
  hint,
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  type = "text",
  error,
  disabled,
  required,
  autoFocus,
}: {
  formId: string;
  name: keyof AddSiteValues;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const id = fieldId(formId, name);
  const errorId = `${id}-error`;
  const hintId = hint ? `${id}-hint` : undefined;
  const describedBy = [error ? errorId : null, !error && hintId ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="m-0 block text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <p id={errorId} className="m-0 text-[12px] leading-4 text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="m-0 text-[12px] leading-4 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function fieldId(formId: string, name: keyof AddSiteValues | AddSiteField): string {
  return `${formId}-${name}`;
}
