#!/bin/sh
set -eu
: "${API_URL:?Set the public HTTPS URL of the API}"
case "$API_URL" in https://*) ;; *) echo "API_URL must use HTTPS" >&2; exit 1 ;; esac
PORT="${PORT:-80}"
case "$PORT" in ''|*[!0-9]*) echo "Invalid PORT" >&2; exit 1 ;; esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ]
sed -i "s/listen       80;/listen       ${PORT};/g" /etc/nginx/conf.d/default.conf
for value in "${RPC_ENABLED:-false}" "${SINGLE_TENANT_MODE:-true}"; do
  case "$value" in true|false) ;; *) echo "Use true/false boolean values" >&2; exit 1 ;; esac
done
mkdir -p /usr/share/nginx/html/settings
# Serialize only public configuration. Quotes/newlines cannot inject JavaScript.
jq -n --arg api "$API_URL" \
  --arg explorer "${STELLAR_EXPERT_URL:-https://stellar.expert/explorer/testnet}" \
  --arg horizon "${HORIZON_URL:-https://horizon-testnet.stellar.org}" \
  --arg captcha "${RECAPTCHA_SITE_KEY:-}" \
  --argjson rpc "${RPC_ENABLED:-false}" \
  --argjson single "${SINGLE_TENANT_MODE:-true}" \
  '{API_URL:$api, STELLAR_EXPERT_URL:$explorer, HORIZON_URL:$horizon,
    RECAPTCHA_SITE_KEY:$captcha, RPC_ENABLED:$rpc, SINGLE_TENANT_MODE:$single,
    DISABLE_TENANT_PREFIL_FROM_DOMAIN:"true", USE_SSO:false}' \
  | sed '1s/^/window._env_ = /;$s/$/;/' > /usr/share/nginx/html/settings/env-config.js
