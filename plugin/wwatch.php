<?php
/**
 * Plugin Name: wwatch
 * Description: Lets the wwatch board log you into wp-admin. More board actions can use this same REST namespace later.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: MIT
 */

if (!defined("ABSPATH")) {
  exit();
}

const WWATCH_VERSION = "1.0.0";
const WWATCH_LOGIN_TTL = 30;

add_action("rest_api_init", "wwatch_register_rest");
add_action("init", "wwatch_consume_login", 0);

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
}

function wwatch_can_manage(): bool
{
  return current_user_can("manage_options");
}

function wwatch_capabilities()
{
  return [
    "version" => WWATCH_VERSION,
    "capabilities" => ["login"],
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
