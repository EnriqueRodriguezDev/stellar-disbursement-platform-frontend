#!/bin/sh
set -e

# Adjust nginx listening port to Railway's dynamic $PORT
if [ -n "$PORT" ]; then
  sed -i "s/listen       80;/listen       ${PORT};/g" /etc/nginx/conf.d/default.conf
fi

# Generate runtime env-config.js consumed by src/constants/envVariables.ts
mkdir -p /usr/share/nginx/html/settings
cat <<EOF > /usr/share/nginx/html/settings/env-config.js
window._env_ = {
  API_URL: "${API_URL:-http://localhost:8000}",
  STELLAR_EXPERT_URL: "${STELLAR_EXPERT_URL:-https://stellar.expert/explorer/testnet}",
  HORIZON_URL: "${HORIZON_URL:-https://horizon-testnet.stellar.org}",
  RPC_ENABLED: ${RPC_ENABLED:-true},
  RECAPTCHA_SITE_KEY: "${RECAPTCHA_SITE_KEY:-}",
  SINGLE_TENANT_MODE: ${SINGLE_TENANT_MODE:-true}
};
EOF

echo "===> Generated /settings/env-config.js with API_URL=${API_URL:-http://localhost:8000}"
