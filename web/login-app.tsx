import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function LoginApp() {
  return <LoginForm />;
}

function LoginForm() {
  const [error, setError] = useState("");
  return (
    <div className="modal">
      <form
        className="dialog-shell"
        onSubmit={(event) => {
          event.preventDefault();
          const password = new FormData(event.currentTarget).get("password");
          setError("");
          void (async () => {
            try {
              await api("/api/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ password }),
              });
              location.href = "/app";
            } catch (err) {
              setError(
                err instanceof Error && err.message === "too many attempts"
                  ? "Too many attempts. Try again later."
                  : "Wrong password.",
              );
            }
          })();
        }}
      >
        <h2>wwatch</h2>
        <p className="help">This board is password-protected.</p>
        <label>
          Password
          <Input name="password" type="password" required />
        </label>
        <div className="mt-3 flex justify-end">
          <Button type="submit">Open</Button>
        </div>
        <p className="help" role="alert" aria-live="assertive">
          {error}
        </p>
      </form>
    </div>
  );
}
