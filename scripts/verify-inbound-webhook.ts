// scripts/verify-inbound-webhook.ts
// The inbound-email webhook refuses unsigned, stale and wrongly signed
// requests, and acknowledges mail that is not for this feature.
//
//   npm run verify:inbound-webhook
//
// Runs with INBOUND_EMAIL_DOMAIN unset, so it never reads or writes the database.

import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
const SECRET = 'whsec_' + Buffer.from('test-secret-key-123').toString('base64');
process.env.RESEND_INBOUND_WEBHOOK_SECRET = SECRET;
delete process.env.INBOUND_EMAIL_DOMAIN;
let pass = 0, fail = 0;
const eq = (l: string, g: unknown, w: unknown) => { const ok = JSON.stringify(g) === JSON.stringify(w); ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${ok ? '' : ` got ${JSON.stringify(g)} want ${JSON.stringify(w)}`}`); };
function signed(body: string, opts: { age?: number; secret?: string } = {}) {
  const id = 'msg_1', ts = String(Math.floor(Date.now() / 1000) - (opts.age ?? 0));
  const key = Buffer.from((opts.secret ?? SECRET).replace(/^whsec_/, ''), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return new NextRequest('https://x/api/webhooks/inbound-email', { method: 'POST', body, headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` } });
}
(async () => {
  const { POST } = await import('../app/api/webhooks/inbound-email/route');
  const recv = JSON.stringify({ type: 'email.received', data: { email_id: 'e1', to: ['abcdefghijkmnpqr@in.example.com'] } });
  const r1 = await POST(new NextRequest('https://x', { method: 'POST', body: recv }));
  eq('unsigned rejected', r1.status, 401);
  const r2 = await POST(signed(recv, { age: 600 }));
  eq('stale signature rejected (replay)', r2.status, 401);
  const r3 = await POST(signed(recv, { secret: 'whsec_' + Buffer.from('wrong').toString('base64') }));
  eq('wrong secret rejected', r3.status, 401);
  const r4 = await POST(signed(JSON.stringify({ type: 'email.delivered', data: { email_id: 'x' } })));
  eq('other events acknowledged and ignored', [r4.status, (await r4.json()).ignored], [200, true]);
  const r5 = await POST(signed(recv));
  eq('feature off: mail is not ours, acknowledged', [r5.status, (await r5.json()).status], [200, 'not_ours']);
  const r6 = await POST(signed('not json'));
  eq('bad JSON rejected', r6.status, 400);
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
