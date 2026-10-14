# SDP dashboard on Railway (develop based on upstream main)

Use Dockerfile.railway with the checked-in railway.toml. Runtime Variables:

- API_URL: public HTTPS sdp-api domain, not its internal Railway address.
- SINGLE_TENANT_MODE=true; RPC_ENABLED=false for the initial classic-wallet setup.
- RECAPTCHA_SITE_KEY: public site key configured for this dashboard domain.
- HORIZON_URL and STELLAR_EXPERT_URL: Testnet endpoints from the example.
- PORT: supplied by Railway; Nginx adapts to it.

There is NO PostgreSQL connection in frontend. Backend/TSS own DATABASE_URL.
Never add a seed, SendGrid key, admin token or DB password to frontend Variables.
Only allowlisted public settings are JSON-serialized to /settings/env-config.js;
that file is served without caching and configured at container startup.

No REACT_APP_* build-time overrides are needed on Railway. Local .env files are
excluded from the Docker context to avoid overriding runtime API_URL or baking
credentials into the image. Build runs vite directly, without requiring .git.

Create a public Railway domain for this service. Set backend SDP_UI_BASE_URL and
CORS_ALLOWED_ORIGINS to that exact HTTPS origin, then redeploy backend. Import the
example only after replacing REPLACE_API_DOMAIN. Follow the backend railway/README.md
for PostgreSQL, migrations, initial tenant, email/MFA and TSS setup.

Runtime check: GET /settings/env-config.js must show the expected API_URL; login
requests must target it. No localhost fallback. A /health backend check is not
proof of successful login or a disbursement.
