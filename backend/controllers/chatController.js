const ApiResponse = require('../utils/apiResponse');
const { Conversation, Message, Contact } = require('../models/zindex');
const socket = require('../config/socket');

// Precise Meta 24-hour customer service window calculator
const compute24HourWindow = (conversation, now = Date.now()) => {
  // A 24-hour service window is ONLY open if:
  // 1. The customer sent an inbound message (lastCustomerMessageAt is a valid Date)
  // 2. The time elapsed since that message is <= 24 hours
  if (!conversation.lastCustomerMessageAt) {
    return {
      hasCustomerMessaged: false,
      isWindowOpen: false,
      windowExpiresInHours: 0,
      windowExpiresInMinutes: 0,
      sessionStatus: 'NO_INBOUND_SESSION' // Customer has never messaged; template required
    };
  }

  const lastCustTime = new Date(conversation.lastCustomerMessageAt).getTime();
  if (isNaN(lastCustTime)) {
    return {
      hasCustomerMessaged: false,
      isWindowOpen: false,
      windowExpiresInHours: 0,
      windowExpiresInMinutes: 0,
      sessionStatus: 'NO_INBOUND_SESSION'
    };
  }

  const elapsedMs = now - lastCustTime;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  if (elapsedHours >= 0 && elapsedHours <= 24) {
    const remainingHours = Math.max(0, 24 - elapsedHours);
    const remainingMinutes = Math.max(0, Math.round((24 - elapsedHours) * 60));
    return {
      hasCustomerMessaged: true,
      isWindowOpen: true,
      windowExpiresInHours: remainingHours,
      windowExpiresInMinutes: remainingMinutes,
      sessionStatus: 'ACTIVE'
    };
  }

  return {
    hasCustomerMessaged: true,
    isWindowOpen: false,
    windowExpiresInHours: 0,
    windowExpiresInMinutes: 0,
    sessionStatus: 'EXPIRED'
  };
};

const listConversations = async (req, res, next) => {
  try {
    const { status, assignedTo, search } = req.query;
    const filter = { tenantId: req.tenantId };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (assignedTo === 'mine') {
      filter.assignedAgentId = req.user._id;
    } else if (assignedTo === 'unassigned') {
      filter.assignedAgentId = null;
    } else if (assignedTo && assignedTo !== 'all') {
      filter.assignedAgentId = assignedTo;
    }

    let conversations = await Conversation.find(filter)
      .populate('contactId')
      .populate('assignedAgentId', 'name email')
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(100);

    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter((c) => {
        const name = c.contactId?.name?.toLowerCase() || '';
        const phone = c.contactId?.phone?.toLowerCase() || '';
        return name.includes(searchLower) || phone.includes(searchLower);
      });
    }

    // Append accurate 24-hour window status for each conversation
    const now = Date.now();
    const formatted = conversations.map((conv) => {
      const convObj = conv.toObject();
      const windowInfo = compute24HourWindow(convObj, now);
      return {
        ...convObj,
        ...windowInfo
      };
    });

    return ApiResponse.success(res, 'Conversations retrieved successfully.', formatted);
  } catch (error) {
    next(error);
  }
};

const getConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findOne({ _id: conversationId, tenantId: req.tenantId })
      .populate('contactId')
      .populate('assignedAgentId', 'name email');

    if (!conversation) {
      return ApiResponse.notFound(res, 'Conversation not found.');
    }

    // Reset unread count when opened
    if (conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
      await conversation.save();
    }

    const messages = await Message.find({ conversationId: conversation._id, tenantId: req.tenantId })
      .sort({ createdAt: 1 })
      .limit(200);

    const now = Date.now();
    const convObj = conversation.toObject();
    const windowInfo = compute24HourWindow(convObj, now);
    Object.assign(convObj, windowInfo);

    return ApiResponse.success(res, 'Conversation thread retrieved.', {
      conversation: convObj,
      messages
    });
  } catch (error) {
    next(error);
  }
};

const assignAgent = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { agentId } = req.body;

    const conversation = await Conversation.findOne({ _id: conversationId, tenantId: req.tenantId });
    if (!conversation) {
      return ApiResponse.notFound(res, 'Conversation not found.');
    }

    conversation.assignedAgentId = agentId || null;
    await conversation.save();

    // Also update contact assignedAgentId
    if (conversation.contactId) {
      await Contact.findByIdAndUpdate(conversation.contactId, { assignedAgentId: agentId || null });
    }

    // Notify via socket
    socket.emitToTenant(req.tenantId, 'conversation_updated', {
      conversationId: conversation._id,
      assignedAgentId: conversation.assignedAgentId
    });

    return ApiResponse.success(res, 'Agent assigned successfully.', conversation);
  } catch (error) {
    next(error);
  }
};

const toggleBotPause = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findOne({ _id: conversationId, tenantId: req.tenantId });
    if (!conversation) {
      return ApiResponse.notFound(res, 'Conversation not found.');
    }

    conversation.isBotPaused = !conversation.isBotPaused;
    if (conversation.isBotPaused) {
      conversation.handedOffAt = new Date();
    }
    await conversation.save();

    socket.emitToTenant(req.tenantId, 'conversation_updated', {
      conversationId: conversation._id,
      isBotPaused: conversation.isBotPaused
    });

    return ApiResponse.success(
      res,
      `Chatbot ${conversation.isBotPaused ? 'paused (Human Hand-off active)' : 'resumed'}.`,
      conversation
    );
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;

    if (!['open', 'pending', 'resolved'].includes(status)) {
      return ApiResponse.badRequest(res, 'Invalid status. Allowed: open, pending, resolved.');
    }

    const conversation = await Conversation.findOne({ _id: conversationId, tenantId: req.tenantId });
    if (!conversation) {
      return ApiResponse.notFound(res, 'Conversation not found.');
    }

    conversation.status = status;
    await conversation.save();

    socket.emitToTenant(req.tenantId, 'conversation_updated', {
      conversationId: conversation._id,
      status: conversation.status
    });

    return ApiResponse.success(res, `Conversation marked as ${status}.`, conversation);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listConversations,
  getConversation,
  assignAgent,
  toggleBotPause,
  updateStatus
};
