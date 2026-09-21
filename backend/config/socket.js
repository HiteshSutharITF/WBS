let io = null;

const initSocket = (socketIoInstance) => {
  io = socketIoInstance;

  io.on('connection', (socket) => {
    // Client joins their tenant-scoped room
    socket.on('join_tenant', (tenantId) => {
      if (tenantId) {
        socket.join(`tenant_${tenantId}`);
      }
    });

    // Client joins a specific conversation room
    socket.on('join_conversation', (conversationId) => {
      if (conversationId) {
        socket.join(`conv_${conversationId}`);
      }
    });

    socket.on('leave_conversation', (conversationId) => {
      if (conversationId) {
        socket.leave(`conv_${conversationId}`);
      }
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

const emitToTenant = (tenantId, event, data) => {
  if (io && tenantId) {
    io.to(`tenant_${tenantId}`).emit(event, data);
  }
};

const emitToConversation = (conversationId, event, data) => {
  if (io && conversationId) {
    io.to(`conv_${conversationId}`).emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitToTenant,
  emitToConversation
};
