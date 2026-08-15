export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (response.status === 401 && path !== "/api/login" && path !== "/api/logout") {
    location.href = "/login.html";
    throw new Error("auth required");
  }
  if (response.status === 204) {
    return null as T;
  }
  const body = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? response.statusText);
  }
  return body as T;
}
