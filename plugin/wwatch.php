<?php
/**
 * Plugin Name: wwatch
 * Description: Lets the wwatch board log you into wp-admin, update plugins, themes, and core, and fix a few exposed files.
 * Version: 1.2.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: MIT
 */

if (!defined("ABSPATH")) {
  exit();
}

const WWATCH_VERSION = "1.2.0";
const WWATCH_LOGIN_TTL = 30;
const WWATCH_REPAIR_PATHS = [
  "/debug.log",
  "/wp-content/debug.log",
  "/readme.html",
  "/license.txt",
  "/wp-config.php.bak",
  "/wp-config.php.save",
  "/wp-config.php.old",
];

add_action("rest_api_init", "wwatch_register_rest");
add_action("init", "wwatch_consume_login", 0);
add_action("init", "wwatch_block_xmlrpc", 0);
add_filter("xmlrpc_enabled", "wwatch_xmlrpc_enabled");

function wwatch_register_rest(): void
{
  register_rest_route("wwatch/v1", "/", [
    "methods" => "GET",
    "callback" => "wwatch_capabilities",
    "permission_callback" => "wwatch_can_manage",
  ]);
  register_rest_route("wwatch/v1", "/login-link", [
    "methods" => "POST",
    "callback" => "wwatch_mint_login_link",
    "permission_callback" => "wwatch_can_manage",
  ]);
  register_rest_route("wwatch/v1", "/update", [
    "methods" => "POST",
    "callback" => "wwatch_run_update",
    "permission_callback" => "wwatch_can_manage",
    "args" => [
      "kind" => [
        "required" => true,
        "type" => "string",
        "enum" => ["plugin", "theme", "core", "plugins", "themes"],
      ],
      "plugin" => [
        "type" => "string",
      ],
      "theme" => [
        "type" => "string",
      ],
    ],
  ]);
  register_rest_route("wwatch/v1", "/repair", [
    "methods" => "POST",
    "callback" => "wwatch_run_repair",
    "permission_callback" => "wwatch_can_manage",
    "args" => [
      "kind" => [
        "required" => true,
        "type" => "string",
        "enum" => ["exposed_path", "xmlrpc"],
      ],
      "path" => [
        "type" => "string",
      ],
    ],
  ]);
}

function wwatch_can_manage(): bool
{
  return current_user_can("manage_options");
}

function wwatch_capabilities()
{
  return [
    "version" => WWATCH_VERSION,
    "capabilities" => ["login", "update", "repair"],
  ];
}

function wwatch_mint_login_link()
{
  $user_id = get_current_user_id();
  if (!$user_id) {
    return new WP_Error("wwatch_not_logged_in", "Application Password did not authenticate.", [
      "status" => 401,
    ]);
  }

  $token = bin2hex(random_bytes(32));
  set_transient(wwatch_login_key($token), $user_id, WWATCH_LOGIN_TTL);

  return [
    "token" => $token,
    "url" => add_query_arg("wwatch_login", $token, home_url("/")),
    "expires_in" => WWATCH_LOGIN_TTL,
  ];
}

function wwatch_login_key(string $token): string
{
  return "wwatch_login_" . hash("sha256", $token);
}

function wwatch_consume_login(): void
{
  if (!isset($_GET["wwatch_login"]) || !is_string($_GET["wwatch_login"])) {
    return;
  }

  nocache_headers();
  $token = wp_unslash($_GET["wwatch_login"]);
  if (!preg_match("/^[a-f0-9]{64}$/", $token)) {
    wp_die(esc_html("This login link is invalid."), "", ["response" => 400]);
  }

  $key = wwatch_login_key($token);
  $user_id = get_transient($key);
  delete_transient($key);
  if (!is_numeric($user_id)) {
    wp_die(esc_html("This login link expired. Ask the board for a new one."), "", [
      "response" => 403,
    ]);
  }

  $user = get_user_by("id", (int) $user_id);
  if (!$user || !user_can($user, "manage_options")) {
    wp_die(esc_html("This login link expired. Ask the board for a new one."), "", [
      "response" => 403,
    ]);
  }

  wp_set_current_user($user->ID);
  wp_set_auth_cookie($user->ID, false, is_ssl());
  wp_safe_redirect(admin_url());
  exit();
}

function wwatch_run_update(WP_REST_Request $request)
{
  if (defined("DISALLOW_FILE_MODS") && DISALLOW_FILE_MODS) {
    return new WP_Error(
      "wwatch_file_mods",
      "This WordPress site disallows file modifications (DISALLOW_FILE_MODS).",
      ["status" => 400],
    );
  }

  @set_time_limit(120);
  $kind = $request->get_param("kind");
  add_filter("filesystem_method", "wwatch_fs_direct");
  try {
    $loaded = wwatch_load_upgrader();
    if (is_wp_error($loaded)) {
      return $loaded;
    }
    if ($kind === "plugin") {
      return wwatch_update_one_plugin((string) $request->get_param("plugin"));
    }
    if ($kind === "theme") {
      return wwatch_update_one_theme((string) $request->get_param("theme"));
    }
    if ($kind === "core") {
      return wwatch_update_core();
    }
    if ($kind === "plugins") {
      return wwatch_update_plugins();
    }
    return wwatch_update_themes();
  } finally {
    remove_filter("filesystem_method", "wwatch_fs_direct");
  }
}

function wwatch_fs_direct(): string
{
  return "direct";
}

function wwatch_load_upgrader()
{
  require_once ABSPATH . "wp-admin/includes/file.php";
  require_once ABSPATH . "wp-admin/includes/misc.php";
  require_once ABSPATH . "wp-admin/includes/plugin.php";
  require_once ABSPATH . "wp-admin/includes/theme.php";
  require_once ABSPATH . "wp-admin/includes/update.php";
  require_once ABSPATH . "wp-admin/includes/class-wp-upgrader.php";

  if (!WP_Filesystem()) {
    return new WP_Error(
      "wwatch_filesystem",
      "WordPress could not write files. Check filesystem permissions.",
      ["status" => 500],
    );
  }
  return true;
}

function wwatch_plugin_ref(string $raw)
{
  $raw = str_replace("\\", "/", trim($raw));
  if (!preg_match("#^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+\\.php$#", $raw)) {
    return new WP_Error("wwatch_bad_plugin", "Plugin ref must look like directory/file.php.", [
      "status" => 400,
    ]);
  }
  return $raw;
}

function wwatch_theme_slug(string $raw)
{
  $raw = trim($raw);
  if ($raw === "" || strpos($raw, "/") !== false || strpos($raw, "..") !== false || !preg_match("/^[a-zA-Z0-9._-]+$/", $raw)) {
    return new WP_Error("wwatch_bad_theme", "Theme slug must look like a stylesheet directory.", [
      "status" => 400,
    ]);
  }
  return $raw;
}

function wwatch_update_one_plugin(string $raw)
{
  $plugin = wwatch_plugin_ref($raw);
  if (is_wp_error($plugin)) {
    return $plugin;
  }

  wp_update_plugins();
  $current = get_plugin_updates();
  if (!isset($current[$plugin])) {
    return new WP_Error("wwatch_no_plugin_update", "No wordpress.org update is available for this plugin.", [
      "status" => 400,
    ]);
  }

  $skin = new Automatic_Upgrader_Skin();
  $upgrader = new Plugin_Upgrader($skin);
  $result = $upgrader->upgrade($plugin);
  return wwatch_upgrade_result("plugin", $plugin, $result, $skin);
}

function wwatch_update_one_theme(string $raw)
{
  $theme = wwatch_theme_slug($raw);
  if (is_wp_error($theme)) {
    return $theme;
  }

  wp_update_themes();
  $current = get_theme_updates();
  if (!isset($current[$theme])) {
    return new WP_Error("wwatch_no_theme_update", "No wordpress.org update is available for this theme.", [
      "status" => 400,
    ]);
  }

  $skin = new Automatic_Upgrader_Skin();
  $upgrader = new Theme_Upgrader($skin);
  $result = $upgrader->upgrade($theme);
  return wwatch_upgrade_result("theme", $theme, $result, $skin);
}

function wwatch_update_core()
{
  wp_version_check();
  include_once ABSPATH . "wp-admin/includes/class-wp-upgrader.php";
  $updates = get_core_updates();
  if (!is_array($updates) || !$updates) {
    return new WP_Error("wwatch_no_core_update", "No WordPress core update is available.", [
      "status" => 400,
    ]);
  }
  $update = $updates[0];
  if (!is_object($update) || (isset($update->response) && $update->response === "latest")) {
    return new WP_Error("wwatch_no_core_update", "No WordPress core update is available.", [
      "status" => 400,
    ]);
  }

  $skin = new Automatic_Upgrader_Skin();
  $upgrader = new Core_Upgrader($skin);
  $result = $upgrader->upgrade($update);
  return wwatch_upgrade_result("core", "wordpress", $result, $skin);
}

function wwatch_update_plugins()
{
  wp_update_plugins();
  $current = get_plugin_updates();
  $targets = array_keys($current);
  if (!$targets) {
    return [
      "ok" => true,
      "kind" => "plugins",
      "updated" => [],
      "failed" => [],
      "detail" => "Plugins are already up to date.",
    ];
  }

  $skin = new Automatic_Upgrader_Skin();
  $upgrader = new Plugin_Upgrader($skin);
  $results = $upgrader->bulk_upgrade($targets);
  return wwatch_bulk_result("plugins", $targets, $results);
}

function wwatch_update_themes()
{
  wp_update_themes();
  $current = get_theme_updates();
  $targets = array_keys($current);
  if (!$targets) {
    return [
      "ok" => true,
      "kind" => "themes",
      "updated" => [],
      "failed" => [],
      "detail" => "Themes are already up to date.",
    ];
  }

  $skin = new Automatic_Upgrader_Skin();
  $upgrader = new Theme_Upgrader($skin);
  $results = $upgrader->bulk_upgrade($targets);
  return wwatch_bulk_result("themes", $targets, $results);
}

function wwatch_upgrade_result(string $kind, string $target, $result, Automatic_Upgrader_Skin $skin)
{
  if (is_wp_error($result)) {
    return $result;
  }
  if ($result === false) {
    $messages = wwatch_skin_messages($skin);
    return new WP_Error(
      "wwatch_update_failed",
      $messages !== "" ? $messages : "Update failed.",
      ["status" => 400],
    );
  }
  return [
    "ok" => true,
    "kind" => $kind,
    "target" => $target,
    "detail" => "Updated " . $target . ".",
  ];
}

function wwatch_bulk_result(string $kind, array $targets, $results)
{
  if (is_wp_error($results)) {
    return $results;
  }
  if (!is_array($results)) {
    return new WP_Error("wwatch_update_failed", "Update failed.", ["status" => 400]);
  }

  $updated = [];
  $failed = [];
  foreach ($targets as $target) {
    $result = $results[$target] ?? false;
    if ($result && !is_wp_error($result)) {
      $updated[] = $target;
    } else {
      $failed[] = $target;
    }
  }
  if (!$updated && $failed) {
    return new WP_Error("wwatch_update_failed", "Update failed for " . implode(", ", $failed) . ".", [
      "status" => 400,
    ]);
  }

  $parts = [];
  if ($updated) {
    $parts[] = "Updated " . implode(", ", $updated);
  }
  if ($failed) {
    $parts[] = "Failed " . implode(", ", $failed);
  }
  return [
    "ok" => true,
    "kind" => $kind,
    "updated" => $updated,
    "failed" => $failed,
    "detail" => implode(". ", $parts) . ".",
  ];
}

function wwatch_skin_messages(Automatic_Upgrader_Skin $skin): string
{
  if (!method_exists($skin, "get_upgrade_messages")) {
    return "";
  }
  $messages = $skin->get_upgrade_messages();
  if (!is_array($messages)) {
    return "";
  }
  $text = [];
  foreach ($messages as $message) {
    if (is_string($message) && trim($message) !== "") {
      $text[] = wp_strip_all_tags($message);
    }
  }
  return implode(" ", $text);
}

function wwatch_run_repair(WP_REST_Request $request)
{
  $kind = $request->get_param("kind");
  if ($kind === "xmlrpc") {
    return wwatch_repair_xmlrpc();
  }
  return wwatch_repair_exposed_path((string) $request->get_param("path"));
}

function wwatch_repair_xmlrpc()
{
  update_option("wwatch_xmlrpc_disabled", 1, true);
  return [
    "ok" => true,
    "kind" => "xmlrpc",
    "detail" => "XML-RPC disabled.",
  ];
}

function wwatch_xmlrpc_enabled($enabled)
{
  if (get_option("wwatch_xmlrpc_disabled")) {
    return false;
  }
  return $enabled;
}

function wwatch_block_xmlrpc(): void
{
  if (!defined("XMLRPC_REQUEST") || !XMLRPC_REQUEST) {
    return;
  }
  if (!get_option("wwatch_xmlrpc_disabled")) {
    return;
  }
  status_header(403);
  nocache_headers();
  header("Content-Type: text/plain; charset=utf-8");
  echo "XML-RPC is disabled.";
  exit();
}

function wwatch_repair_exposed_path(string $path)
{
  if (!in_array($path, WWATCH_REPAIR_PATHS, true)) {
    return new WP_Error("wwatch_bad_path", "This path cannot be repaired from the board.", [
      "status" => 400,
    ]);
  }
  if ($path === "/debug.log" || $path === "/wp-content/debug.log") {
    return wwatch_delete_debug_logs();
  }
  $basename = basename($path);
  if ($basename === "wp-config.php") {
    return new WP_Error("wwatch_bad_path", "wp-config.php cannot be deleted.", ["status" => 400]);
  }
  $deleted = wwatch_delete_under(ABSPATH, $basename);
  if (is_wp_error($deleted)) {
    return $deleted;
  }
  return [
    "ok" => true,
    "kind" => "exposed_path",
    "path" => $path,
    "detail" => $deleted["detail"],
  ];
}

function wwatch_delete_debug_logs()
{
  $root = wwatch_delete_under(ABSPATH, "debug.log");
  if (is_wp_error($root)) {
    return $root;
  }
  $content = wwatch_delete_under(WP_CONTENT_DIR, "debug.log");
  if (is_wp_error($content)) {
    return $content;
  }
  $names = [];
  if (!empty($root["deleted"])) {
    $names[] = "debug.log";
  }
  if (!empty($content["deleted"])) {
    $names[] = "wp-content/debug.log";
  }
  if (!$names) {
    return [
      "ok" => true,
      "kind" => "exposed_path",
      "path" => "/debug.log",
      "detail" => "debug.log was already gone.",
    ];
  }
  return [
    "ok" => true,
    "kind" => "exposed_path",
    "path" => "/debug.log",
    "detail" => "Deleted " . implode(" and ", $names) . ".",
  ];
}

function wwatch_delete_under(string $dir, string $basename)
{
  if (
    $basename === "" ||
    $basename === "wp-config.php" ||
    strpos($basename, "/") !== false ||
    strpos($basename, "\\") !== false ||
    strpos($basename, "..") !== false
  ) {
    return new WP_Error("wwatch_bad_path", "This path cannot be repaired from the board.", [
      "status" => 400,
    ]);
  }

  $root = realpath($dir);
  if ($root === false) {
    return new WP_Error("wwatch_bad_path", "This path cannot be repaired from the board.", [
      "status" => 400,
    ]);
  }

  $candidate = rtrim($dir, "/\\") . DIRECTORY_SEPARATOR . $basename;
  if (!file_exists($candidate)) {
    return [
      "ok" => true,
      "deleted" => false,
      "detail" => $basename . " was already gone.",
    ];
  }

  $real = realpath($candidate);
  if ($real === false || basename($real) !== $basename || basename($real) === "wp-config.php") {
    return new WP_Error("wwatch_bad_path", "This path cannot be repaired from the board.", [
      "status" => 400,
    ]);
  }

  $prefix = $root . DIRECTORY_SEPARATOR;
  if (strpos($real, $prefix) !== 0 && $real !== $root) {
    return new WP_Error("wwatch_bad_path", "File must stay under the WordPress root.", [
      "status" => 400,
    ]);
  }

  if (dirname($real) !== $root) {
    return new WP_Error("wwatch_bad_path", "File must stay under the WordPress root.", [
      "status" => 400,
    ]);
  }

  if (!@unlink($real)) {
    return new WP_Error("wwatch_unlink", "Could not delete " . $basename . ".", ["status" => 500]);
  }

  return [
    "ok" => true,
    "deleted" => true,
    "detail" => "Deleted " . $basename . ".",
  ];
}
