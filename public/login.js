document.getElementById("login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = new FormData(event.target).get("password");
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    document.getElementById("err").textContent =
      response.status === 429 ? "Too many attempts. Try again later." : "Wrong password.";
    return;
  }
  location.href = "/";
});
