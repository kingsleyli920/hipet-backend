/* Simple data ops: export and clean sessions */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  const op = process.argv[2];
  if (op === 'export') {
    const out = process.argv[3] || `sessions_export_${Date.now()}.json`;
    const sessions = await prisma.chatSession.findMany({ orderBy: { updatedAt: 'desc' } });
    fs.writeFileSync(out, JSON.stringify(sessions, null, 2));
    console.log('exported', sessions.length, 'sessions to', out);
  } else if (op === 'clean') {
    const days = parseInt(process.argv[3] || '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const del = await prisma.chatSession.deleteMany({ where: { endedAt: { lt: since } } });
    console.log('deleted', del.count, 'sessions older than', days, 'days');
  } else {
    console.log('Usage: node scripts/data_ops.js export [outfile] | clean [days]');
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
