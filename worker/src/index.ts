import { AqarWorkspaceDO, WorkerEnv } from './workspaceDo';

export { AqarWorkspaceDO };

const VALID_WORKSPACE_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function resolveWorkspaceId(request: Request, url: URL): string {
  const fromHeader = (request.headers.get('x-workspace-id') || '').trim().toLowerCase();
  if (fromHeader && VALID_WORKSPACE_RE.test(fromHeader)) {
    return fromHeader;
  }
  const fromQuery = (url.searchParams.get('workspace') || '').trim().toLowerCase();
  if (fromQuery && VALID_WORKSPACE_RE.test(fromQuery)) {
    return fromQuery;
  }
  const host = url.hostname.toLowerCase();
  // Support optional company subdomain on custom domains (e.g. company1.aqarplus.sa)
  const parts = host.split('.');
  if (parts.length >= 3 && !host.endsWith('.workers.dev') && parts[0] !== 'www' && parts[0] !== 'app') {
    if (VALID_WORKSPACE_RE.test(parts[0])) {
      return parts[0];
    }
  }
  return 'default';
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    // Route API calls and WebSocket sync connections into the company-isolated Durable Object
    if (url.pathname.startsWith('/api/') || url.pathname === '/ws') {
      const workspaceId = resolveWorkspaceId(request, url);
      const id = env.WORKSPACE_DO.idFromName(`ws:${workspaceId}`);
      const stub = env.WORKSPACE_DO.get(id);
      const headers = new Headers(request.headers);
      headers.set('x-resolved-workspace-id', workspaceId);
      const forwarded = new Request(request, { headers });
      return stub.fetch(forwarded);
    }

    // Serve static PWA/SPA assets (Vite build output in ./dist)
    return env.ASSETS.fetch(request);
  },
};
