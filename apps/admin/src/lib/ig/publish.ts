/* Instagram Content Publishing API — feed images and stories.
   Default: "Instagram API with Instagram Login" (host graph.instagram.com, token from the app dashboard,
   permissions instagram_business_basic + instagram_business_content_publish). Set META_IG_LOGIN=facebook
   for the legacy Facebook-Login flavour (graph.facebook.com, instagram_basic + instagram_content_publish). */

const FACEBOOK_LOGIN = process.env.META_IG_LOGIN === 'facebook';
const GRAPH = FACEBOOK_LOGIN ? 'https://graph.facebook.com/v21.0' : 'https://graph.instagram.com/v21.0';

export interface IgCredentials {
  userId: string;
  accessToken: string;
}

export interface IgPublishResult {
  containerId: string;
  mediaId: string;
}

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

/**
 * With Instagram Login the token is bound to one account, so every call goes to the `me` node and
 * META_IG_USER_ID is optional (informational). With Facebook Login the node must be the IG business id.
 */
export function igCredentials(): IgCredentials | null {
  const accessToken = process.env.META_IG_ACCESS_TOKEN;
  const configured = process.env.META_IG_USER_ID;
  if (!accessToken) return null;
  if (FACEBOOK_LOGIN) return configured ? { userId: configured, accessToken } : null;
  return { userId: 'me', accessToken };
}

async function graph<T>(path: string, params: Record<string, string>, method: 'GET' | 'POST'): Promise<T> {
  const body = new URLSearchParams(params);
  const url = method === 'GET' ? `${GRAPH}${path}?${body.toString()}` : `${GRAPH}${path}`;
  const res = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    body: method === 'POST' ? body : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(`Graph API ${path}: ${e?.message ?? res.statusText} (code ${e?.code ?? res.status}${e?.error_subcode ? `/${e.error_subcode}` : ''})`);
  }
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForContainer(id: string, token: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const c = await graph<{ status_code?: string; status?: string }>(`/${id}`, { fields: 'status_code,status', access_token: token }, 'GET');
    if (c.status_code === 'FINISHED') return;
    if (c.status_code === 'ERROR' || c.status_code === 'EXPIRED') throw new Error(`Container ${id} ${c.status_code}: ${c.status ?? ''}`);
    await sleep(3000);
  }
  throw new Error(`Container ${id} not ready after 60s`);
}

/**
 * Publish a JPEG at a public URL. `kind: 'feed'` posts a single image with a caption;
 * `kind: 'story'` posts it as a story (no caption, no stickers — the API does not support them).
 */
export async function publishImage(
  creds: IgCredentials,
  opts: { kind: 'feed' | 'story'; imageUrl: string; caption?: string }
): Promise<IgPublishResult> {
  const params: Record<string, string> = { image_url: opts.imageUrl, access_token: creds.accessToken };
  if (opts.kind === 'story') params.media_type = 'STORIES';
  else if (opts.caption) params.caption = opts.caption;

  const container = await graph<{ id: string }>(`/${creds.userId}/media`, params, 'POST');
  await waitForContainer(container.id, creds.accessToken);
  const published = await graph<{ id: string }>(
    `/${creds.userId}/media_publish`,
    { creation_id: container.id, access_token: creds.accessToken },
    'POST'
  );
  return { containerId: container.id, mediaId: published.id };
}

/** Sanity check used by the dry run: confirms the token can see the account. */
export async function igAccountInfo(creds: IgCredentials): Promise<{ id: string; user_id?: string; username?: string }> {
  const fields = FACEBOOK_LOGIN ? 'id,username' : 'id,user_id,username';
  return graph<{ id: string; user_id?: string; username?: string }>(`/${creds.userId}`, { fields, access_token: creds.accessToken }, 'GET');
}
