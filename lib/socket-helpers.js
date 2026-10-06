/* eslint-disable @typescript-eslint/no-require-imports */
const { Server } = require('socket.io');

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  global.io = io;

  io.on('connection', (socket) => {
    socket.on('register:user', ({ anonymousToken }) => {
      if (anonymousToken) {
        socket.join(`user:${anonymousToken}`);
      }
    });

    socket.on('register:admin', () => {
      socket.join('admin-room');
    });

    socket.on('join:conversation', ({ conversationId, anonymousToken }) => {
      if (conversationId) {
        socket.join(`conversation:${conversationId}`);
      }
      if (anonymousToken) {
        socket.join(`user:${anonymousToken}`);
      }
    });

    socket.on('typing:start', ({ conversationId, userType, anonymousToken }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        userType,
        anonymousToken
      });
    });

    socket.on('typing:stop', ({ conversationId, userType, anonymousToken }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userType,
        anonymousToken
      });
    });
  });

  return io;
}

module.exports = { initSocketServer };
