const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.userSession.findMany({
    where: { userId: 'cmg95p9jb0000cvf0dpu89owh' },
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  
  console.log('Latest session for user:');
  console.log(JSON.stringify(sessions, null, 2));
  
  if (sessions.length > 0) {
    const session = sessions[0];
    console.log('\nSession details:');
    console.log('- Created:', session.createdAt);
    console.log('- Expires:', session.expiresAt);
    console.log('- Is Active:', session.isActive);
    console.log('- Token Hash (first 50 chars):', session.tokenHash.substring(0, 50));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
