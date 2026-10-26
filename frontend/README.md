# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on build and development performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for details on configuring lint rules.

## Deploying to Vercel

Vercel builds the frontend from the repository root using `vercel.json`. The
repository also contains a Vercel serverless API proxy at `api/[...path].ts`.
The proxy keeps browser authentication cookies on the frontend origin; it does
not run the Express backend or the Python face worker.

The Express API must be deployed separately as an **always-on Docker service**.
Vercel Functions are not a replacement for that persistent service. Build the
container from the `Backend` directory using `Backend/Dockerfile`; it includes
the Python face worker and downloads the pinned face models during image build.
Use persistent external MongoDB and Redis services for production. Do not rely on
the local MongoDB/Redis containers or an ephemeral filesystem for production
data.

After deploying the backend, set these Vercel Production environment variables:

- `BACKEND_URL`: the backend's HTTPS origin only, e.g.
  `https://your-backend-host.example` (no `/api` suffix)
- `VITE_API_URL=/api`

Set these backend environment variables in the Docker host:

- `NODE_ENV=production`
- `CLIENT_URL`: the exact Vercel frontend origin, e.g.
  `https://your-project.vercel.app` (no path)
- `API_BASE_URL`: the public Vercel origin plus `/api`, e.g.
  `https://your-project.vercel.app/api`; register the resulting Google OAuth
  callback URL (`/auth/google/callback`) in Google Cloud Console
- `PORT` to the port expected by the container host
- `MONGODB_URI`, `REDIS_URL`, and a strong `JWT_SECRET`
- For face sign-in: `FACE_ENROLLMENT_ENABLED=true` and a securely generated,
  persistent `BIOMETRIC_ENCRYPTION_KEY`; the Docker image supplies
  `FACE_PYTHON_PATH` and the model files

Keep `BACKEND_URL` server-side; do not prefix it with `VITE_`. Set the
environment variables before deploying and redeploy after changing them.
Registration, login, OAuth callbacks, and face verification should use the
same-origin `/api` proxy. Do not point `VITE_API_URL` at `localhost` in a
production build.

The Socket.IO notification service is a persistent connection and is not
forwarded by the serverless API proxy. Real-time notifications therefore need a
separately reachable Socket.IO endpoint; the frontend leaves Socket.IO
disconnected when only the `/api` proxy is configured.

This setup makes the frontend deployable on Vercel, but does not provision a
backend host, database, Redis, OAuth credentials, or biometric encryption key.
Vercel alone cannot keep the Express API and face worker running 24/7.
