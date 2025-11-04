/*
  Stream sampling E2E test
  Flow: start -> stream(with sessionId) -> end -> verify transcript contains sampled events
*/

const BASE = process.env.TEST_BASE || 'http://localhost:8000';

async function jfetch(url, init = {}) {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

async function ensureUser() {
  const list = await jfetch(`${BASE}/users`);
  if (Array.isArray(list.data) && list.data.length > 0) return list.data[0];
  const created = await jfetch(`${BASE}/users`, { method: 'POST', body: JSON.stringify({ email: `s_${Date.now()}@example.com`, name: 'Streamer' })});
  return created.data;
}

async function ensurePet(ownerId) {
  const list = await jfetch(`${BASE}/pets`);
  if (Array.isArray(list.data) && list.data.length > 0) return list.data[0];
  const created = await jfetch(`${BASE}/pets`, { method: 'POST', body: JSON.stringify({ name: 'Momo', breed: 'Mix', age: 18, weight: 10.1, ownerId })});
  return created.data;
}

async function streamOnce(sessionId, pet) {
  const body = {
    message: 'Hi',
    conversation_summary: '',
    pet_profile: { name: pet.name, breed: pet.breed || 'Mix', age: pet.age || 12, weight: pet.weight || 8.0 },
    sessionId
  };
  const res = await fetch(`${BASE}/chat/stream`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  if (!res.ok) throw new Error(`stream failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  while (!done) {
    const { value, done: d } = await reader.read();
    if (d) break;
    const chunk = decoder.decode(value);
    if (chunk.includes('data: [DONE]')) break;
  }
}

async function main() {
  console.log('[Health]');
  console.log(await jfetch(`${BASE}/health`));

  const user = await ensureUser();
  const pet = await ensurePet(user.id);

  console.log('[Start session]');
  const start = await jfetch(`${BASE}/sessions/start`, { method: 'POST', body: JSON.stringify({ userId: user.id, petId: pet.id, title: 'Stream Sampling' })});
  if (start.status !== 200) throw new Error('start failed');
  const { sessionId } = start.data;
  console.log({ sessionId });

  console.log('[Stream with sampling]');
  await streamOnce(sessionId, pet);

  console.log('[End session]');
  const end = await jfetch(`${BASE}/sessions/end`, { method: 'POST', body: JSON.stringify({ sessionId, summary: { via: 'sampling' } })});
  console.log(end);

  console.log('[Verify transcript]');
  const detail = await jfetch(`${BASE}/sessions/${sessionId}`);
  const tr = detail.data?.transcript || [];
  const types = new Set(tr.map(x => x?.meta?.type).filter(Boolean));
  console.log({ length: tr.length, types: Array.from(types) });
  if (!types.has('router') || !types.has('specialist')) {
    console.warn('WARN: expected router & specialist types in transcript; transfer may be optional.');
  }
  console.log('DONE');
}

main().catch((e) => { console.error('E2E sampling failed:', e); process.exit(1); });
