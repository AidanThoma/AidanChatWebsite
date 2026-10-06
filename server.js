const { createServer } = require('http');
const next = require('next');
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const { initSocketServer } = require('./lib/socket-helpers');

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname: '0.0.0.0', port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (!existing) {
    const passwordHash = await hash(password, 10);
    await prisma.adminUser.create({
      data: {
        email,
        passwordHash
      }
    });
  }
}

async function start() {
  await app.prepare();
  await ensureAdminUser();

  const server = createServer((req, res) => handle(req, res));
  initSocketServer(server);

  server.listen(port, '0.0.0.0', () => {
    console.log(`Ready on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
