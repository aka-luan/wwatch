export type AddSiteValues = {
  name: string;
  origin: string;
  username: string;
  applicationPassword: string;
};

export type AddSiteField = "origin" | "username" | "applicationPassword";

export type AddSiteFieldErrors = Partial<Record<AddSiteField, string>>;

export function emptyAddSiteValues(): AddSiteValues {
  return {
    name: "",
    origin: "",
    username: "",
    applicationPassword: "",
  };
}

export function validateAddSite(values: AddSiteValues): AddSiteFieldErrors {
  const errors: AddSiteFieldErrors = {};
  const origin = values.origin.trim();
  if (!origin) {
    errors.origin = "Enter the site URL.";
  } else if (!/^https?:\/\//i.test(origin)) {
    errors.origin = "Enter a full URL starting with https://.";
  } else {
    try {
      const url = new URL(origin);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.origin = "Enter a full URL starting with https://.";
      }
    } catch {
      errors.origin = "Enter a valid site URL, like https://bakery.example.";
    }
  }

  if (!values.username.trim()) {
    errors.username = "Enter your WordPress login username.";
  }
  if (!values.applicationPassword.trim()) {
    errors.applicationPassword = "Enter the Application Password.";
  }
  return errors;
}

/** Map backend connect errors onto a field when the message points there. */
export function classifyConnectError(message: string): {
  field?: AddSiteField;
  form: string;
} {
  const text = message.trim() || "Could not connect.";
  const lower = text.toLowerCase();

  if (
    lower.includes("already connected") ||
    lower.includes("origin must") ||
    lower.includes("absolute url") ||
    lower.includes("must be https") ||
    lower.includes("must not include credentials") ||
    lower.includes("metadata") ||
    lower.includes("link-local")
  ) {
    return { field: "origin", form: text };
  }

  if (lower.includes("username and application password")) {
    return { form: text };
  }

  if (
    lower.includes("invalid_username") ||
    (lower.includes("username") && lower.includes("login") && !lower.includes("password"))
  ) {
    return { field: "username", form: text };
  }

  if (
    lower.includes("application password") ||
    lower.includes("incorrect_password") ||
    lower.includes("did not see the application password") ||
    lower.includes("was rejected") ||
    lower.includes("are disabled")
  ) {
    return { field: "applicationPassword", form: text };
  }

  return { form: text };
}
