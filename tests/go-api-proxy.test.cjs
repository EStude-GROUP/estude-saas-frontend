const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { EventEmitter, once } = require('node:events');
const { WebSocket, WebSocketServer } = require('ws');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');
const proxy = loadTypeScript('lib/go-api-proxy.ts');
const host = 'student.school-a.saas.example.test';
const origin = `https://${host}`;

function env(t, values) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}
function request(url = '/api/v1/tenant', init = {}) {
  return new Request(`https://${host}${url}`, {
    ...init,
    headers: { host, origin, ...init.headers },
  });
}
async function listen(t, server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  const target = `http://127.0.0.1:${server.address().port}`;
  env(t, { GO_API_URL: target, NODE_ENV: 'development' });
  return target;
}

test('keeps school Host, auth, idempotency, JSON body and host-only cookies', async (t) => {
  await listen(t, http.createServer((req, res) => {
    assert.equal(req.url, '/api/v1/auth/student/login?next=dashboard');
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.host, host);
    assert.equal(req.headers.origin, origin);
    assert.equal(req.headers.cookie, 'refresh=fixture');
    assert.equal(req.headers.authorization, 'Bearer fixture');
    assert.equal(req.headers['idempotency-key'], 'unique-action');
    assert.equal(req.headers['x-course-offering-id'], 'f296a6b4-c5ca-490c-a3ea-2a6d8790edf4');
    assert.equal(req.headers['x-tenant-slug'], undefined);
    assert.equal(req.headers['x-forwarded-host'], undefined);
    assert.equal(req.headers['x-forwarded-for'], undefined);
    let body = '';
    req.on('data', (part) => { body += part; });
    req.on('end', () => {
      assert.deepEqual(JSON.parse(body), { accountName: 'student', password: 'fixture' });
      res.writeHead(201, {
        'Content-Type': 'application/json',
        'Set-Cookie': ['refresh=next; HttpOnly; Secure; SameSite=Strict', 'other=value; HttpOnly'],
        'X-Total-Count': '42',
      });
      res.end('{"success":true}');
    });
  }));
  const response = await proxy.forwardGoApi(request('/api/v1/auth/student/login?next=dashboard', {
    method: 'POST',
    headers: { Cookie: 'refresh=fixture', Authorization: 'Bearer fixture',
      'Idempotency-Key': 'unique-action', 'Content-Type': 'application/json',
      'X-Course-Offering-ID': 'f296a6b4-c5ca-490c-a3ea-2a6d8790edf4',
      'X-Tenant-Slug': 'forged', 'X-Forwarded-Host': 'admin.other.test', 'X-Forwarded-For': '1.2.3.4' },
    body: JSON.stringify({ accountName: 'student', password: 'fixture' }),
  }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-total-count'), '42');
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.deepEqual(await response.json(), { success: true });
});

test('rejects home/preview/control hosts and control paths without contacting Go', async (t) => {
  let calls = 0;
  await listen(t, http.createServer((_req, res) => { calls++; res.end(); }));
  for (const invalidHost of ['estude.io.vn', 'preview.vercel.app', 'saas-admin.estude.io.vn', 'admin@evil.test']) {
    const response = await proxy.forwardGoApi(request(undefined, { headers: { host: invalidHost } }));
    assert([400, 404].includes(response.status));
    assert.equal((await response.json()).success, false);
  }
  assert.equal((await proxy.forwardGoApi(request('/api/platform/v1/tenants'))).status, 404);
  assert.equal(calls, 0);
});

test('production requires an explicit HTTPS root destination', async (t) => {
  env(t, { NODE_ENV: 'production', GO_API_URL: undefined });
  assert.equal((await proxy.forwardGoApi(request())).status, 503);
  for (const target of ['http://127.0.0.1:8090', 'https://api.test/api/v1', 'https://name:secret@api.test', 'https://api.test?target=x']) {
    process.env.GO_API_URL = target;
    assert.equal((await proxy.forwardGoApi(request())).status, 503);
  }
});

test('rejects oversized requests before forwarding', async (t) => {
  let calls = 0;
  await listen(t, http.createServer((_req, res) => { calls++; res.end(); }));
  const result = await proxy.forwardGoApi(request('/api/v1/assignments', {
    method: 'POST', body: 'x'.repeat(1024 * 1024 + 1),
  }));
  assert.equal(result.status, 413);
  assert.equal(calls, 0);
});

test('preserves backend rejection, binary downloads and empty responses', async (t) => {
  const bytes = Buffer.from([0, 255, 1, 128]);
  await listen(t, http.createServer((req, res) => {
    if (req.url.endsWith('/forbidden')) {
      assert.equal(req.headers.origin, 'https://foreign.test');
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end('{"success":false,"message":"Origin invalid"}');
    } else if (req.url.endsWith('/empty')) { res.writeHead(204); res.end(); }
    else {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="report.xlsx"' });
      res.end(bytes);
    }
  }));
  const forbidden = await proxy.forwardGoApi(request('/api/v1/forbidden', { headers: { origin: 'https://foreign.test' } }));
  assert.equal(forbidden.status, 403);
  assert.equal((await forbidden.json()).message, 'Origin invalid');
  const file = await proxy.forwardGoApi(request('/api/v1/report'));
  assert.equal(file.headers.get('content-disposition'), 'attachment; filename="report.xlsx"');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  const empty = await proxy.forwardGoApi(request('/api/v1/empty'));
  assert.equal(empty.status, 204);
  assert.equal(await empty.text(), '');
});

test('HTTPS verifies API certificate and signs school Host while routing to API Host', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'estude-school-tls-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const key = path.join(directory, 'key.pem'), cert = path.join(directory, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  const ca = fs.readFileSync(cert);
  const server = https.createServer({ key: fs.readFileSync(key), cert: ca }, (req, res) => {
    assert.equal(req.socket.servername, 'localhost');
    assert.equal(req.headers.host, `localhost:${server.address().port}`);
    assert.equal(req.headers['x-estude-portal-host'], host);
    res.end('verified');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  env(t, { NODE_ENV: 'production', PORTAL_PROXY_SECRET: 'signed-proxy-fixture-key-at-least-32-bytes', GO_API_URL: `https://localhost:${server.address().port}` });
  const secured = loadTypeScript('lib/go-api-proxy.ts', (name) => name === 'node:https' ? {
    request(url, options) {
      assert.equal(options.rejectUnauthorized, undefined);
      return https.request(url, { ...options, ca });
    },
  } : require(name));
  const response = await secured.forwardGoApi(request());
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'verified');
});

test('offline Go returns a JSON gateway error', async (t) => {
  env(t, { NODE_ENV: 'development', GO_API_URL: 'http://127.0.0.1:0' });
  const response = await proxy.forwardGoApi(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).success, false);
});

function chat(upgrade) {
  return loadTypeScript('lib/go-chat-proxy.ts', (name) => {
    if (name === '@/lib/go-api-proxy') return proxy;
    if (name === '@vercel/functions') return { upgradeWebSocket: upgrade };
    return require(name);
  });
}
test('chat rejects ordinary requests and foreign Origins before connecting', async (t) => {
  let calls = 0;
  await listen(t, http.createServer((_req, res) => { calls++; res.end(); }));
  const { forwardGoChat } = chat(() => { throw Error('must not upgrade'); });
  assert.equal((await forwardGoChat(request('/api/v1/class-chat/ws'))).status, 426);
  assert.equal((await forwardGoChat(request('/api/v1/class-chat/ws', {
    headers: { Upgrade: 'websocket', Origin: 'https://foreign.test' },
  }))).status, 403);
  assert.equal(calls, 0);
});

test('chat bridge preserves text auth and frames; closes both connections', async (t) => {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  t.after(() => { for (const socket of wss.clients) socket.terminate(); wss.close(); });
  await listen(t, server);
  let upstreamClosed;
  const closed = new Promise((resolve) => { upstreamClosed = resolve; });
  wss.on('connection', (socket, req) => {
    assert.equal(req.headers.host, host);
    assert.equal(req.headers.origin, origin);
    socket.on('message', (data, binary) => {
      assert.equal(binary, false);
      assert.deepEqual(JSON.parse(data.toString()), { event: 'auth', token: 'fixture-token' });
      socket.send('{"event":"connect","payload":{"ok":true}}');
    });
    socket.on('close', upstreamClosed);
  });
  class Client extends EventEmitter {
    readyState = WebSocket.OPEN;
    bufferedAmount = 0;
    send(data, _options, callback) { this.emit('received', data); callback?.(); }
    close(code) { this.readyState = WebSocket.CLOSED; this.emit('close', code); }
  }
  const client = new Client();
  const { forwardGoChat } = chat(async (handler, options) => {
    assert.equal(options.maxPayload, 64 * 1024);
    const running = handler(client);
    client.emit('message', Buffer.from('{"event":"auth","token":"fixture-token"}'), false);
    const [data] = await once(client, 'received');
    assert.equal(JSON.parse(data.toString()).event, 'connect');
    client.close(1000);
    await running;
    return new Response(null, { status: 204 });
  });
  const response = await forwardGoChat(request('/api/v1/class-chat/ws', { headers: { Upgrade: 'websocket' } }));
  assert.equal(response.status, 204);
  await closed;
});

test('school proxy forwards a mobile avatar above 1 MiB while keeping bounded limits on other uploads', async (t) => {
  let count = 0;
  await listen(t, http.createServer((req, res) => {
    assert.equal(req.url, '/api/v1/auth/profile/avatar');
    assert.match(req.headers['content-type'], /^multipart\/form-data/);
    let size = 0;
    req.on('data', (chunk) => { size += chunk.length; });
    req.on('end', () => { count++; assert.equal(size, 1536 * 1024); res.end('{"success":true,"data":{}}'); });
  }));
  const body = new Uint8Array(1536 * 1024);
  const avatar = await proxy.forwardGoApi(request('/api/v1/auth/profile/avatar', {
    method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=fixture' }, body,
  }));
  assert.equal(avatar.status, 200);
  assert.equal((await avatar.json()).success, true);
  const generic = await proxy.forwardGoApi(request('/api/v1/student/assignments/id/files', {
    method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=fixture' }, body,
  }));
  assert.equal(generic.status, 413);
  const oversized = await proxy.forwardGoApi(request('/api/v1/auth/profile/avatar', {
    method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=fixture' }, body: new Uint8Array(2 * 1024 * 1024 + 64 * 1024 + 1),
  }));
  assert.equal(oversized.status, 413);
  assert.equal(count, 1);
});

test('caches only the versioned school logo; everything else stays no-store', async (t) => {
  await listen(t, http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' });
    res.end('png');
  }));
  const versioned = await proxy.forwardGoApi(request('/api/v1/tenant/logo?v=7'));
  assert.equal(versioned.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  for (const url of ['/api/v1/tenant/logo', '/api/v1/tenant/logo?v=abc', '/api/v1/tenant']) {
    const response = await proxy.forwardGoApi(request(url));
    assert.equal(response.headers.get('cache-control'), 'no-store', url);
    await response.arrayBuffer();
  }
  await versioned.arrayBuffer();
});
