const table = document.getElementById("table");
const stats = document.getElementById("stats");
const drawer = document.getElementById("drawer");
const modal = document.getElementById("modal");

let selected = null;
let sites = [];

document.getElementById("add").addEventListener("click", showAdd);
document.getElementById("scan-all").addEventListener("click", async () => {
  await api("/api/scan-all", { method: "POST" });
  await refresh();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (!modal.hidden) {
    closeModal();
    return;
  }
  if (!drawer.hidden) {
    closeDrawer();
  }
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

await refresh();
setInterval(refresh, 2500);

async function refresh() {
  sites = await api("/api/sites");
  renderStats();
  renderTable();
  if (selected) {
    const row = sites.find((item) => item.site.id === selected);
    if (row) {
      renderDrawer(row);
    }
  }
}

function renderStats() {
  const counts = { ok: 0, degraded: 0, down: 0, auth_failed: 0, running: 0, never: 0 };
  let scanning = 0;
  for (const row of sites) {
    counts[row.rollup] += 1;
    if (row.running) {
      scanning += 1;
    }
  }
  const problems = counts.degraded + counts.down + counts.auth_failed;
  stats.innerHTML = `
    <span><b>${sites.length}</b> sites</span>
    <span><b>${problems}</b> need attention</span>
    <span><b>${scanning}</b> scanning</span>
  `;
}

function renderTable() {
  if (sites.length === 0) {
    table.innerHTML = `
      <div class="empty">
        <h2>No sites yet</h2>
        <p>Add a WordPress site you already admin. wwatch talks to it with an Application Password from Users → Profile. Nothing gets installed on the site.</p>
      </div>`;
    return;
  }
  table.innerHTML = `
    <div class="board-wrap">
      <table>
        <thead>
          <tr>
            <th>Site</th>
            <th>Status</th>
            <th>Core</th>
            <th>Plugins</th>
            <th>Findings</th>
            <th>Last scan</th>
          </tr>
        </thead>
        <tbody>
          ${sites.map(rowHtml).join("")}
        </tbody>
      </table>
    </div>
    <div class="board-cards">
      ${sites.map(cardHtml).join("")}
    </div>`;
  for (const el of table.querySelectorAll("[data-id]")) {
    el.addEventListener("click", () => {
      selected = el.dataset.id;
      const row = sites.find((item) => item.site.id === selected);
      if (row) {
        renderDrawer(row);
      }
    });
  }
}

function rowSummary(row) {
  const findings = row.latest?.findings ?? [];
  const plugins = row.latest?.plugins ?? [];
  return {
    findings,
    plugins,
    updates: findings.filter((f) => f.kind === "plugin_update").length,
    crit: findings.filter((f) => f.severity === "crit").length,
    warn: findings.filter((f) => f.severity === "warn").length,
  };
}

function scanLabel(row) {
  if (row.running) {
    return row.latest ? `scanning · ${ago(row.latest.finishedAt)}` : "scanning…";
  }
  return ago(row.latest?.finishedAt);
}

function statusPills(row) {
  return `${pill(row.rollup)}${row.running && row.latest ? ' <span class="pill running">scan</span>' : ""}`;
}

function rowHtml(row) {
  const { findings, plugins, updates, crit, warn } = rowSummary(row);
  return `
    <tr class="row" data-id="${escape(row.site.id)}">
      <td>
        <div>${escape(row.site.name)}</div>
        <div class="mono host">${escape(host(row.site.origin))}</div>
      </td>
      <td>${statusPills(row)}</td>
      <td class="mono">${escape(row.latest?.coreVersion ?? "—")}</td>
      <td>${plugins.length ? `${plugins.length} installed${updates ? `, ${updates} updates` : ""}` : "—"}</td>
      <td>${findings.length ? `${crit} crit · ${warn} warn` : "—"}</td>
      <td>${scanLabel(row)}</td>
    </tr>`;
}

function cardHtml(row) {
  const { findings, plugins, updates, crit, warn } = rowSummary(row);
  const pluginLabel = plugins.length
    ? `${plugins.length} plugin${plugins.length === 1 ? "" : "s"}${updates ? `, ${updates} update${updates === 1 ? "" : "s"}` : ""}`
    : "No plugins";
  const findingLabel = findings.length ? `${crit} crit · ${warn} warn` : "No findings";
  const coreLabel = row.latest?.coreVersion ? `WP ${row.latest.coreVersion}` : "No core version";
  return `
    <button type="button" class="site-card" data-id="${escape(row.site.id)}">
      <div class="site-card-head">
        <div>
          <div class="site-card-name">${escape(row.site.name)}</div>
          <div class="mono host">${escape(host(row.site.origin))}</div>
        </div>
        <div class="site-card-pills">${statusPills(row)}</div>
      </div>
      <div class="site-card-meta">
        <span class="mono">${escape(coreLabel)}</span>
        <span>${escape(pluginLabel)}</span>
        <span>${escape(findingLabel)}</span>
        <span>${escape(scanLabel(row))}</span>
      </div>
    </button>`;
}

function renderDrawer(row) {
  const findings = row.latest?.findings ?? [];
  const plugins = row.latest?.plugins ?? [];
  document.body.classList.add("drawer-open");
  drawer.hidden = false;
  drawer.classList.remove("hidden");
  drawer.innerHTML = `
    <header>
      <div>
        <h2>${escape(row.site.name)}</h2>
        <p class="origin"><a href="${escape(row.site.origin)}" target="_blank" rel="noreferrer">${escape(row.site.origin)}</a></p>
      </div>
      <div class="actions">
        <button type="button" id="scan-one">Scan</button>
        <button type="button" id="close-drawer">Close</button>
      </div>
    </header>
    <p>${pill(row.rollup)} ${row.latest?.coreVersion ? ` · WP ${escape(row.latest.coreVersion)}` : ""}</p>
    <h3>Findings</h3>
    ${
      findings.length
        ? findings.map(findingHtml).join("")
        : "<p class='help'>No findings on the last scan.</p>"
    }
    <h3>Plugins</h3>
    ${
      plugins.length
        ? plugins.map((plugin) => pluginHtml(plugin, findings)).join("")
        : "<p class='help'>No plugin list yet. Scan with a working Application Password.</p>"
    }
    <div class="row-actions">
      <button class="danger" type="button" id="remove">Remove site</button>
    </div>`;
  drawer.querySelector("#close-drawer").addEventListener("click", closeDrawer);
  drawer.querySelector("#scan-one").addEventListener("click", async () => {
    await api(`/api/sites/${row.site.id}/scan`, { method: "POST" });
    await refresh();
  });
  drawer.querySelector("#remove").addEventListener("click", async () => {
    if (!confirm(`Remove ${row.site.name}?`)) {
      return;
    }
    await api(`/api/sites/${row.site.id}`, { method: "DELETE" });
    selected = null;
    closeDrawer();
    await refresh();
  });
  for (const button of drawer.querySelectorAll("[data-plugin]")) {
    button.addEventListener("click", async () => {
      await api(`/api/sites/${row.site.id}/plugins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plugin: button.dataset.plugin,
          status: button.dataset.status,
        }),
      });
      await api(`/api/sites/${row.site.id}/scan`, { method: "POST" });
      await refresh();
    });
  }
}

function findingHtml(finding) {
  return `
    <div class="finding">
      ${pill(finding.severity)}
      <strong>${escape(finding.title)}</strong>
      <p>${escape(finding.detail)}</p>
    </div>`;
}

function pluginHtml(plugin, findings) {
  const update = findings.find((f) => f.kind === "plugin_update" && f.plugin === plugin.ref);
  const next = plugin.status === "active" ? "inactive" : "active";
  return `
    <div class="plugin">
      <div>
        <strong>${escape(plugin.name)}</strong>
        ${pill(plugin.status)}
        ${update ? pill("warn") + " " + escape(plugin.version + " → " + update.latest) : `<span class="mono"> ${escape(plugin.version)}</span>`}
        <p class="mono">${escape(plugin.ref)}</p>
      </div>
      <button type="button" data-plugin="${escape(plugin.ref)}" data-status="${next}">
        Set ${next}
      </button>
    </div>`;
}

function showAdd() {
  document.body.classList.add("modal-open");
  modal.hidden = false;
  modal.classList.remove("hidden");
  modal.innerHTML = `
    <form class="card" id="add-form">
      <h2>Add a WordPress site</h2>
      <p class="help">In wp-admin open Users → Profile → Application Passwords. Create one on an administrator account. Username is that account's login (what you type at wp-login), not the password's name.</p>
      <label>Name<input name="name" placeholder="Bakery" /></label>
      <label>Site URL<input name="origin" required placeholder="https://bakery.example" /></label>
      <label>WP username<input name="username" required placeholder="your WordPress login" autocomplete="username" /></label>
      <label>Application password<input name="applicationPassword" required autocomplete="current-password" /></label>
      <p id="add-error" class="error"></p>
      <div class="row-actions">
        <button type="button" id="cancel-add">Cancel</button>
        <button class="primary" type="submit">Connect</button>
      </div>
    </form>`;
  modal.querySelector("#cancel-add").addEventListener("click", closeModal);
  modal.querySelector("#add-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const err = modal.querySelector("#add-error");
    err.textContent = "";
    const data = Object.fromEntries(new FormData(event.target));
    try {
      const site = await api("/api/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      closeModal();
      await api(`/api/sites/${site.id}/scan`, { method: "POST" });
      selected = site.id;
      await refresh();
    } catch (error) {
      err.textContent = error instanceof Error ? error.message : "Could not connect";
    }
  });
}

function closeDrawer() {
  selected = null;
  document.body.classList.remove("drawer-open");
  drawer.hidden = true;
  drawer.classList.add("hidden");
  drawer.innerHTML = "";
}

function closeModal() {
  document.body.classList.remove("modal-open");
  modal.hidden = true;
  modal.classList.add("hidden");
  modal.innerHTML = "";
}

function pill(value) {
  return `<span class="pill ${value}">${escape(value.replace("_", " "))}</span>`;
}

function host(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

function ago(iso) {
  if (!iso) {
    return "never";
  }
  const ms = Date.now() - Date.parse(iso);
  const min = Math.round(ms / 60000);
  if (min < 1) {
    return "just now";
  }
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.round(min / 60);
  if (hr < 48) {
    return `${hr}h ago`;
  }
  return `${Math.round(hr / 24)}d ago`;
}

function escape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function api(path, init) {
  const response = await fetch(path, init);
  if (response.status === 401 && path !== "/api/login") {
    location.href = "/login.html";
    throw new Error("auth required");
  }
  if (response.status === 204) {
    return null;
  }
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? response.statusText);
  }
  return body;
}
