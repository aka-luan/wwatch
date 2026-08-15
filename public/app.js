const table = document.getElementById("table");
const stats = document.getElementById("stats");
const drawer = document.getElementById("drawer");
const modal = document.getElementById("modal");

let selected = null;
let sites = [];
let loginError = "";

document.getElementById("add").addEventListener("click", showAdd);
document.getElementById("logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  location.href = "/";
});
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
    if (!row) {
      selected = null;
      closeDrawer();
      return;
    }
    await showSite(selected);
  }
}

async function showSite(id) {
  const page = await api(`/api/sites/${id}`);
  renderDrawer(page);
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
        <p>Add a WordPress site you already admin. wwatch talks to it with an Application Password from Users → Profile. Scans install nothing on the site. Log in from the drawer needs the optional wwatch plugin.</p>
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
      loginError = "";
      showSite(selected);
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
  const helper = row.latest?.helper ?? null;
  const canUpdate = helperCan(helper, "update");
  const updateFindings = findings.filter(
    (finding) => finding.kind === "plugin_update" || finding.kind === "theme_update",
  );
  const previous = (row.history ?? []).filter((scan) => scan.id !== row.latest?.id);
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
        <button type="button" id="wp-login">Log in</button>
        ${canUpdate && updateFindings.length ? `<button type="button" id="update-all">Update all</button>` : ""}
        <button type="button" id="scan-one">Scan</button>
        <button type="button" id="edit-site">Edit</button>
        <button type="button" id="close-drawer">Close</button>
      </div>
    </header>
    <p>${pill(row.rollup)} ${row.latest?.coreVersion ? ` · WP ${escape(row.latest.coreVersion)}` : ""}</p>
    <p class="help">${helperHelp(helper)}</p>
    ${loginError ? `<p class="error">${escape(loginError)}</p>` : ""}
    <h3>Findings</h3>
    ${
      findings.length
        ? findings.map((finding) => findingHtml(finding, helper)).join("")
        : "<p class='help'>No findings on the last scan.</p>"
    }
    <h3>Previous scans</h3>
    ${
      previous.length
        ? previous.map(scanHtml).join("")
        : "<p class='help'>No earlier scans.</p>"
    }
    <h3>Plugins</h3>
    ${
      plugins.length
        ? plugins.map((plugin) => pluginHtml(plugin, findings, canUpdate)).join("")
        : "<p class='help'>No plugin list yet. Scan with a working Application Password.</p>"
    }
    <div class="row-actions">
      <button class="danger" type="button" id="remove">Remove site</button>
    </div>`;
  drawer.querySelector("#close-drawer").addEventListener("click", closeDrawer);
  drawer.querySelector("#edit-site").addEventListener("click", () => showEdit(row));
  drawer.querySelector("#wp-login").addEventListener("click", () => wpLogin(row));
  const updateAll = drawer.querySelector("#update-all");
  if (updateAll) {
    updateAll.addEventListener("click", () => {
      if (!confirm("Update every plugin and theme that has a wordpress.org update? Core is not included.")) {
        return;
      }
      applyUpdate(row, { kind: "all" });
    });
  }
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
  for (const button of drawer.querySelectorAll("[data-status]")) {
    button.addEventListener("click", async () => {
      const name = button.dataset.name ?? button.dataset.plugin;
      const status = button.dataset.status;
      if (!confirm(`Set ${name} to ${status}?`)) {
        return;
      }
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
  for (const button of drawer.querySelectorAll("[data-update]")) {
    button.addEventListener("click", () => {
      const kind = button.dataset.update;
      const name = button.dataset.name ?? kind;
      const body =
        kind === "plugin"
          ? { kind: "plugin", plugin: button.dataset.plugin }
          : kind === "theme"
            ? { kind: "theme", theme: button.dataset.theme }
            : { kind: "core" };
      const prompt =
        kind === "core"
          ? `Update WordPress to a new version on ${row.site.name}? Back up first if you have not.`
          : `Update ${name} on ${row.site.name}?`;
      if (!confirm(prompt)) {
        return;
      }
      applyUpdate(row, body);
    });
  }
  for (const button of drawer.querySelectorAll("[data-repair]")) {
    button.addEventListener("click", () => {
      const kind = button.dataset.repair;
      const path = button.dataset.path;
      const title = button.dataset.name ?? path ?? kind;
      const body = kind === "xmlrpc" ? { kind: "xmlrpc" } : { kind: "exposed_path", path };
      const prompt =
        kind === "xmlrpc"
          ? `Disable XML-RPC on ${row.site.name}? This does not delete xmlrpc.php.`
          : `Delete ${title} on ${row.site.name}?`;
      if (!confirm(prompt)) {
        return;
      }
      applyRepair(row, body);
    });
  }
}

function scanHtml(scan) {
  return `
    <div class="scan">
      ${pill(scan.rollup)}
      <span>${ago(scan.finishedAt)}</span>
      <span>${scan.counts.crit} crit · ${scan.counts.warn} warn</span>
    </div>`;
}

function findingHtml(finding, helper) {
  const action = updateAction(finding, helperCan(helper, "update")) || repairAction(finding, helperCan(helper, "repair"));
  return `
    <div class="finding${action ? " has-action" : ""}">
      <div>
        ${pill(finding.severity)}
        <strong>${escape(finding.title)}</strong>
        <p>${escape(finding.detail)}</p>
      </div>
      ${action ?? ""}
    </div>`;
}

function updateAction(finding, canUpdate) {
  if (!canUpdate) {
    return "";
  }
  if (finding.kind === "plugin_update") {
    return `<button type="button" data-update="plugin" data-plugin="${escape(finding.plugin)}" data-name="${escape(finding.title)}">Update</button>`;
  }
  if (finding.kind === "theme_update") {
    return `<button type="button" data-update="theme" data-theme="${escape(finding.theme)}" data-name="${escape(finding.title)}">Update</button>`;
  }
  if (finding.kind === "core_update") {
    return `<button type="button" data-update="core" data-name="${escape(finding.title)}">Update</button>`;
  }
  return "";
}

function repairAction(finding, canRepair) {
  if (!canRepair) {
    return "";
  }
  if (finding.kind === "xmlrpc_open") {
    return `<button type="button" data-repair="xmlrpc" data-name="XML-RPC">Fix</button>`;
  }
  if (finding.kind === "exposed_path" && isRepairablePath(finding.path)) {
    return `<button type="button" data-repair="exposed_path" data-path="${escape(finding.path)}" data-name="${escape(finding.path)}">Fix</button>`;
  }
  return "";
}

const REPAIRABLE_PATHS = [
  "/debug.log",
  "/wp-content/debug.log",
  "/readme.html",
  "/license.txt",
  "/wp-config.php.bak",
  "/wp-config.php.save",
  "/wp-config.php.old",
];

function isRepairablePath(path) {
  return REPAIRABLE_PATHS.includes(path);
}

function pluginHtml(plugin, findings, canUpdate) {
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
      <div class="plugin-actions">
        ${
          canUpdate && update
            ? `<button type="button" data-update="plugin" data-plugin="${escape(plugin.ref)}" data-name="${escape(plugin.name)}">Update</button>`
            : ""
        }
        <button type="button" data-plugin="${escape(plugin.ref)}" data-name="${escape(plugin.name)}" data-status="${next}">
          Set ${next}
        </button>
      </div>
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

function showEdit(row) {
  document.body.classList.add("modal-open");
  modal.hidden = false;
  modal.classList.remove("hidden");
  modal.innerHTML = `
    <form class="card" id="edit-form">
      <h2>Edit ${escape(row.site.name)}</h2>
      <p class="help">Leave the Application Password blank to keep the one already stored. Changing username or password checks the REST API before saving, so scan history stays.</p>
      <label>Name<input name="name" value="${escape(row.site.name)}" /></label>
      <p class="help mono">${escape(row.site.origin)}</p>
      <label>WP username<input name="username" value="${escape(row.username ?? "")}" autocomplete="username" /></label>
      <label>Application password<input name="applicationPassword" placeholder="leave blank to keep" autocomplete="new-password" /></label>
      <p id="edit-error" class="error"></p>
      <div class="row-actions">
        <button type="button" id="cancel-edit">Cancel</button>
        <button class="primary" type="submit">Save</button>
      </div>
    </form>`;
  modal.querySelector("#cancel-edit").addEventListener("click", closeModal);
  modal.querySelector("#edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const err = modal.querySelector("#edit-error");
    err.textContent = "";
    const data = Object.fromEntries(new FormData(event.target));
    const body = { name: data.name, username: data.username };
    if (String(data.applicationPassword ?? "").trim()) {
      body.applicationPassword = data.applicationPassword;
    }
    try {
      await api(`/api/sites/${row.site.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      closeModal();
      await refresh();
    } catch (error) {
      err.textContent = error instanceof Error ? error.message : "Could not update";
    }
  });
}

async function applyUpdate(row, body) {
  loginError = "";
  try {
    await api(`/api/sites/${row.site.id}/update`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  } catch (error) {
    loginError = error instanceof Error ? error.message : "Could not update";
    await showSite(row.site.id);
  }
}

async function applyRepair(row, body) {
  loginError = "";
  try {
    await api(`/api/sites/${row.site.id}/repair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  } catch (error) {
    loginError = error instanceof Error ? error.message : "Could not repair";
    await showSite(row.site.id);
  }
}

function helperCan(helper, capability) {
  return Boolean(helper && helper.kind === "installed" && helper.capabilities?.includes(capability));
}

function helperHelp(helper) {
  if (!helper || helper.kind === "missing") {
    return `Install the <a href="/api/helper-plugin">wwatch plugin</a> to log in, update, or fix findings from the board.`;
  }
  if (!helperCan(helper, "update")) {
    return `This plugin can log in. Download the current <a href="/api/helper-plugin">wwatch plugin</a> to update or fix findings from the board.`;
  }
  if (!helperCan(helper, "repair")) {
    return `This plugin can log in and update. Download the current <a href="/api/helper-plugin">wwatch plugin</a> to fix exposed files from the board.`;
  }
  return `Log in opens wp-admin. Update and Fix use the wwatch plugin on this site.`;
}

async function wpLogin(row) {
  loginError = "";
  const button = drawer.querySelector("#wp-login");
  if (button) {
    button.disabled = true;
  }
  const tab = window.open("about:blank", "wp-admin");
  try {
    const result = await api(`/api/sites/${row.site.id}/wp-login`, { method: "POST" });
    if (tab) {
      tab.opener = null;
      tab.location.replace(result.url);
    } else {
      loginError = "The browser blocked the login window. Allow popups for this board.";
      await showSite(row.site.id);
    }
  } catch (error) {
    tab?.close();
    loginError = error instanceof Error ? error.message : "Could not log in";
    await showSite(row.site.id);
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function closeDrawer() {
  selected = null;
  loginError = "";
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
  if (response.status === 401 && path !== "/api/login" && path !== "/api/logout") {
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
