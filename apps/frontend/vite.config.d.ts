/**
 * Dev proxy: backend Spring Boot uses context-path /api.
 * Docker Compose maps the backend to host port 8081 by default (8080 often busy).
 * Override: VITE_API_PROXY_TARGET=http://127.0.0.1:8080 npm run dev
 */
declare const _default: import("vite").UserConfigFnObject;
export default _default;
