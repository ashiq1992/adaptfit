/**
 * Cloudflare entry point. The runtime only allows handler exports here, so all
 * logic (and everything the tests import) lives in ./logic.ts.
 */
import { cleanup, handle, type Env } from './logic';

export default {
  fetch: (request: Request, env: Env) => handle(request, env),
  scheduled: (_event: unknown, env: Env) => cleanup(env.DB, new Date()),
};
