import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Send,
  Paperclip,
  Clock,
  Bot,
  FileText,
  Image as ImageIcon,
  StickyNote,
  RefreshCw,
  UploadCloud,
  Smile,
  MoreVertical,
  MessageSquarePlus,
  X
} from 'lucide-react';
import { chatService } from '../../services/chatService';
import { contactService } from '../../services/contactService';
import { templateService } from '../../services/templateService';
import { userService } from '../../services/userService';
import { getSocket } from '../../utils/socket';
import { formatTime, formatDate, getMediaUrl, isUsableMediaRef } from '../../utils/formatters';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import {
  WhatsAppMessageBubble,
  WhatsAppTemplatePreview
} from '../../components/inbox/WhatsAppMessageBubble';

const formatRemainingWindow = (hours, minutes) => {
  if (!hours && !minutes) return 'Expired';
  const h = Math.floor(hours || 0);
  const m = Math.round((minutes || 0) % 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
};

const contactInitial = (name) => (name?.[0] || '?').toUpperCase();

const InboxPage = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeData, setActiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateParams, setTemplateParams] = useState({});
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [uploadingHeaderMedia, setUploadingHeaderMedia] = useState(false);
  const headerFileInputRef = useRef(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [isNoteDrawerOpen, setIsNoteDrawerOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const res = await chatService.listConversations({ status: statusFilter, search: searchTerm });
      setConversations(res.data || []);
      if (!activeConvId && res.data?.length > 0) {
        setActiveConvId(res.data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    userService.listTeamMembers().then((res) => setTeamMembers(res.data || [])).catch(() => {});
    templateService.listTemplates({ status: 'APPROVED' }).then((res) => setTemplates(res.data || [])).catch(() => {});
  }, []);

  const loadActiveChat = async (id) => {
    if (!id) return;
    setChatLoading(true);
    try {
      const res = await chatService.getConversation(id);
      setActiveData(res.data);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to load chat thread:', err.message);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (activeConvId) {
      setActiveData(null);
      loadActiveChat(activeConvId);
    }
  }, [activeConvId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const sameId = (a, b) => a != null && b != null && String(a) === String(b);

    const resolveMessagePayload = (payload) => {
      if (!payload) return { message: null, conversationId: null };
      if (payload.message) {
        return {
          message: payload.message,
          conversationId: payload.conversationId || payload.message.conversationId
        };
      }
      return { message: payload, conversationId: payload.conversationId };
    };

    const handleNewMessage = (payload) => {
      const { message: newMsg, conversationId: rawConvId } = resolveMessagePayload(payload);
      if (!newMsg) return;

      const msgConvId = rawConvId || newMsg.conversationId;
      if (!msgConvId) return;

      const isInbound = newMsg.direction === 'inbound';
      const isActiveChat = sameId(activeConvId, msgConvId);

      // Only append into the currently open thread (never mix chats)
      if (isActiveChat) {
        setActiveData((prev) => {
          if (!prev) return prev;
          if (prev.conversation && !sameId(prev.conversation._id, msgConvId)) {
            return prev;
          }
          const exists = prev.messages.some(
            (m) =>
              sameId(m._id, newMsg._id) ||
              (m.wamid && newMsg.wamid && m.wamid === newMsg.wamid)
          );
          if (exists) return prev;
          return {
            ...prev,
            conversation: isInbound
              ? {
                  ...prev.conversation,
                  isWindowOpen: true,
                  hasCustomerMessaged: true,
                  sessionStatus: 'ACTIVE',
                  windowExpiresInHours: 24,
                  windowExpiresInMinutes: 1440,
                  unreadCount: 0
                }
              : prev.conversation,
            messages: [...prev.messages, newMsg]
          };
        });
        setTimeout(scrollToBottom, 100);
      }

      setConversations((prev) => {
        let found = false;
        const next = prev.map((c) => {
          if (!sameId(c._id, msgConvId)) return c;
          found = true;
          return {
            ...c,
            lastMessageText: newMsg.content || `[${(newMsg.messageType || 'msg').toUpperCase()}]`,
            lastMessageAt: newMsg.createdAt || newMsg.sentAt || new Date().toISOString(),
            unreadCount: isInbound
              ? isActiveChat
                ? 0
                : (c.unreadCount || 0) + 1
              : c.unreadCount || 0,
            isWindowOpen: isInbound ? true : c.isWindowOpen,
            hasCustomerMessaged: isInbound ? true : c.hasCustomerMessaged,
            sessionStatus: isInbound ? 'ACTIVE' : c.sessionStatus,
            windowExpiresInHours: isInbound ? 24 : c.windowExpiresInHours
          };
        });
        if (!found) return next;
        return [...next].sort(
          (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
        );
      });
    };

    const handleStatusUpdate = ({ messageId, status, errorCode, errorMessage }) => {
      setActiveData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            sameId(m._id, messageId) ? { ...m, status, errorCode, errorMessage } : m
          )
        };
      });
    };

    const handleConvUpdated = (payload = {}) => {
      if (!payload?.conversationId) {
        fetchConversations();
        return;
      }
      setConversations((prev) =>
        prev.map((c) => {
          if (!sameId(c._id, payload.conversationId)) return c;
          const patch = { ...c };
          if ('status' in payload) patch.status = payload.status;
          if ('unreadCount' in payload) patch.unreadCount = payload.unreadCount;
          if ('lastMessageText' in payload) patch.lastMessageText = payload.lastMessageText;
          if ('lastMessageAt' in payload) patch.lastMessageAt = payload.lastMessageAt;
          if ('isWindowOpen' in payload) patch.isWindowOpen = payload.isWindowOpen;
          if ('hasCustomerMessaged' in payload) patch.hasCustomerMessaged = payload.hasCustomerMessaged;
          if ('sessionStatus' in payload) patch.sessionStatus = payload.sessionStatus;
          if ('windowExpiresInHours' in payload) patch.windowExpiresInHours = payload.windowExpiresInHours;
          // Viewing this chat → keep unread cleared
          if (sameId(activeConvId, payload.conversationId)) patch.unreadCount = 0;
          return patch;
        })
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_message', handleNewMessage);
    socket.on('message_status_updated', handleStatusUpdate);
    socket.on('conversation_updated', handleConvUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_message', handleNewMessage);
      socket.off('message_status_updated', handleStatusUpdate);
      socket.off('conversation_updated', handleConvUpdated);
    };
  }, [activeConvId]);

  // Join / leave conversation rooms when switching chats
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeConvId) return;
    const id = String(activeConvId);
    socket.emit('join_conversation', id);
    setConversations((prev) =>
      prev.map((c) => (String(c._id) === id ? { ...c, unreadCount: 0 } : c))
    );
    return () => {
      socket.emit('leave_conversation', id);
    };
  }, [activeConvId]);

  const handleSendText = async (e) => {
    e?.preventDefault();
    if (!textInput.trim() || sending) return;
    setSending(true);
    try {
      await chatService.sendTextMessage(activeConvId, textInput.trim());
      setTextInput('');
      scrollToBottom();
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleHeaderFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeaderMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await chatService.uploadMediaAsset(formData);
      if (res.data?.url) setHeaderMediaUrl(res.data.url);
    } catch (err) {
      alert('Failed to upload header media: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingHeaderMedia(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;

    const headerFormat = selectedTemplate.header?.format;
    if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(headerFormat) && !isUsableMediaRef(headerMediaUrl)) {
      alert(
        `This template requires a ${headerFormat.toLowerCase()} header. Upload a file or paste a public HTTPS URL.`
      );
      return;
    }

    const bodyMatches = selectedTemplate.body?.text?.match(/\{\{(\d+)\}\}/g) || [];
    const requiredVarNums = [
      ...new Set(bodyMatches.map((m) => parseInt(m.replace(/\D/g, ''), 10)).filter((n) => !Number.isNaN(n)))
    ].sort((a, b) => a - b);

    for (const varNum of requiredVarNums) {
      if (!templateParams[varNum] || !String(templateParams[varNum]).trim()) {
        alert(`Please fill body variable {{${varNum}}} before sending.`);
        return;
      }
    }

    if (
      headerFormat === 'TEXT' &&
      (selectedTemplate.header.text?.match(/\{\{\d+\}\}/g) || []).length > 0 &&
      !String(headerText || '').trim()
    ) {
      alert('Please fill the header text variable before sending.');
      return;
    }

    setSending(true);
    try {
      const maxVar = requiredVarNums.length ? Math.max(...requiredVarNums) : 0;
      const paramsArray = [];
      for (let i = 1; i <= maxVar; i += 1) {
        paramsArray.push(templateParams[i] != null ? String(templateParams[i]) : '');
      }

      await chatService.sendTemplateMessage(activeConvId, selectedTemplate._id, paramsArray, {
        headerMediaUrl: isUsableMediaRef(headerMediaUrl) ? headerMediaUrl : undefined,
        headerText: headerText || undefined
      });
      setIsTemplateModalOpen(false);
      setSelectedTemplate(null);
      setTemplateParams({});
      setHeaderMediaUrl('');
      setHeaderText('');
      loadActiveChat(activeConvId);
    } catch (err) {
      alert(err.message || 'Failed to send template message.');
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async () => {
    if (!mediaFile) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('conversationId', activeConvId);
      formData.append('file', mediaFile);
      formData.append('caption', mediaCaption);
      await chatService.sendMediaMessage(formData);
      setIsMediaModalOpen(false);
      setMediaFile(null);
      setMediaCaption('');
      loadActiveChat(activeConvId);
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleToggleBot = async () => {
    try {
      const res = await chatService.toggleBotPause(activeConvId);
      if (activeData) {
        setActiveData({
          ...activeData,
          conversation: { ...activeData.conversation, isBotPaused: res.data.isBotPaused }
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssignAgent = async (agentId) => {
    try {
      await chatService.assignAgent(activeConvId, agentId);
      if (activeData) {
        setActiveData({
          ...activeData,
          conversation: { ...activeData.conversation, assignedAgentId: agentId }
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !activeData?.conversation?.contactId?._id) return;
    try {
      const res = await contactService.addNote(activeData.conversation.contactId._id, newNoteText.trim());
      setActiveData((prev) => ({
        ...prev,
        conversation: {
          ...prev.conversation,
          contactId: { ...prev.conversation.contactId, notes: res.data }
        }
      }));
      setNewNoteText('');
    } catch (err) {
      alert(err.message);
    }
  };

  const activeConv = activeData?.conversation;
  const isWindowOpen = activeConv?.isWindowOpen;
  const canFreeform = isWindowOpen && activeConv?.hasCustomerMessaged;

  return (
    <div className="wa-inbox h-full w-full flex overflow-hidden bg-[#111b21]">
      {/* ===== Left: Chat list (WhatsApp style) ===== */}
      <div className="w-full max-w-[400px] md:w-[400px] flex flex-col shrink-0 bg-white border-r border-[#d1d7db]">
        <div className="h-[60px] px-4 bg-[#f0f2f5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="wa-avatar wa-avatar-sm bg-[#dfe5e7] text-[#54656f]">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <span className="font-medium text-[#111b21] text-[16px]">Chats</span>
          </div>
          <div className="flex items-center gap-1 text-[#54656f]">
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              className="p-2 rounded-full hover:bg-black/5"
              title="Send template"
            >
              <FileText className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={fetchConversations}
              className="p-2 rounded-full hover:bg-black/5"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-3 py-2 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-[#54656f] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search or start a new chat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-[14px] bg-[#f0f2f5] rounded-lg border-0 outline-none text-[#111b21] placeholder:text-[#667781]"
            />
          </div>
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
            {['all', 'open', 'pending', 'resolved'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-[12px] font-medium rounded-full capitalize whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-[#e7fce3] text-[#008069]'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-10 text-center text-[#667781] text-sm">No chats yet</div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv._id === activeConvId;
              const contact = conv.contactId;
              return (
                <button
                  key={conv._id}
                  type="button"
                  onClick={() => setActiveConvId(conv._id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left border-b border-[#f0f2f5] transition-colors ${
                    isSelected ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                  }`}
                >
                  <div className="wa-avatar">{contactInitial(contact?.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[16px] text-[#111b21] truncate">
                        {contact?.name || 'Unknown'}
                      </span>
                      <span className="text-[12px] text-[#667781] shrink-0">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p
                        className={`text-[14px] truncate ${
                          (conv.unreadCount || 0) > 0
                            ? 'text-[#111b21] font-semibold'
                            : 'text-[#667781]'
                        }`}
                      >
                        {conv.lastMessageText || 'Tap to open chat'}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(conv.sessionStatus === 'ACTIVE' ||
                          (conv.isWindowOpen && conv.hasCustomerMessaged)) &&
                          !(conv.unreadCount > 0) && (
                          <span className="w-2 h-2 rounded-full bg-[#25d366]" title="24h window open" />
                        )}
                        {conv.sessionStatus === 'EXPIRED' && !(conv.unreadCount > 0) && (
                          <span className="w-2 h-2 rounded-full bg-[#f0b429]" title="Template required" />
                        )}
                        {(conv.unreadCount || 0) > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#25d366] text-white text-[11px] font-semibold flex items-center justify-center">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ===== Right: Active chat ===== */}
      {activeConv ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2]">
          {/* Chat header */}
          <div className="h-[60px] px-4 bg-[#f0f2f5] flex items-center justify-between shrink-0 border-l border-[#d1d7db]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="wa-avatar wa-avatar-sm">{contactInitial(activeConv.contactId?.name)}</div>
              <div className="min-w-0">
                <h3 className="font-medium text-[16px] text-[#111b21] truncate leading-tight">
                  {activeConv.contactId?.name}
                </h3>
                <p className="text-[13px] text-[#667781] truncate">
                  {activeConv.contactId?.phone}
                  {activeConv.sessionStatus === 'ACTIVE' || (isWindowOpen && activeConv.hasCustomerMessaged)
                    ? ` · online window ${formatRemainingWindow(activeConv.windowExpiresInHours, activeConv.windowExpiresInMinutes)}`
                    : activeConv.sessionStatus === 'EXPIRED'
                      ? ' · 24h window closed'
                      : ' · send a template to start'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[#54656f] relative">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium bg-[#00a884] text-white hover:bg-[#008f72]"
              >
                <FileText className="w-4 h-4" />
                Template
              </button>
              <button
                type="button"
                onClick={handleToggleBot}
                className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-[12px] font-semibold border transition-colors ${
                  activeConv.isBotPaused
                    ? 'bg-[#fff3cd] text-[#664d03] border-[#ffecb5] hover:bg-[#ffe69c]'
                    : 'bg-[#e7fce3] text-[#008069] border-[#c6f0c2] hover:bg-[#d9fdd3]'
                }`}
                title={
                  activeConv.isBotPaused
                    ? 'Chatbot is OFF for this chat (human mode). Click to turn bot ON.'
                    : 'Chatbot is ON for this chat. Click to pause bot (human mode).'
                }
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    activeConv.isBotPaused ? 'bg-[#f0b429] text-white' : 'bg-[#00a884] text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                </span>
                <span>{activeConv.isBotPaused ? 'Bot OFF' : 'Bot ON'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsNoteDrawerOpen(!isNoteDrawerOpen)}
                className="p-2 rounded-full hover:bg-black/5"
                title="Contact info"
              >
                <StickyNote className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                className="p-2 rounded-full hover:bg-black/5"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {headerMenuOpen && (
                <div className="absolute right-0 top-12 z-20 w-52 bg-white rounded-md shadow-lg border border-[#e9edef] py-1 text-[14px]">
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-[#f0f2f5] text-[#111b21]"
                    onClick={() => {
                      setIsTemplateModalOpen(true);
                      setHeaderMenuOpen(false);
                    }}
                  >
                    Send template message
                  </button>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-[#f0f2f5] text-[#111b21]"
                    onClick={() => {
                      setIsNoteDrawerOpen(true);
                      setHeaderMenuOpen(false);
                    }}
                  >
                    Contact info
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto wa-chat-wallpaper px-4 md:px-16 py-3 space-y-1">
            {chatLoading ? (
              <div className="flex justify-center p-10">
                <RefreshCw className="w-6 h-6 animate-spin text-[#667781]" />
              </div>
            ) : (
              activeData?.messages?.map((msg) => <WhatsAppMessageBubble key={msg._id} msg={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="bg-[#f0f2f5] px-2 py-2.5 shrink-0">
            {canFreeform ? (
              <form onSubmit={handleSendText} className="flex items-end gap-2">
                <button
                  type="button"
                  className="p-2.5 text-[#54656f] hover:text-[#111b21] rounded-full"
                  title="Emoji"
                >
                  <Smile className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(true)}
                  className="p-2.5 text-[#54656f] hover:text-[#111b21] rounded-full"
                  title="Attach"
                >
                  <Paperclip className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="p-2.5 text-[#54656f] hover:text-[#111b21] rounded-full sm:hidden"
                  title="Template"
                >
                  <FileText className="w-6 h-6" />
                </button>
                <input
                  type="text"
                  placeholder="Type a message"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="wa-composer-input"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || sending}
                  className="wa-send-btn"
                  aria-label="Send"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-2">
                <div className="flex-1 flex items-start gap-2 bg-[#fff3cd] text-[#664d03] rounded-lg px-3 py-2.5 text-[13px]">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      {!activeConv?.hasCustomerMessaged
                        ? 'Messaging window not started'
                        : '24-hour messaging window closed'}
                    </p>
                    <p className="mt-0.5 opacity-90">
                      Only approved template messages can be sent. For image templates, upload the header
                      media before sending.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#00a884] text-white text-[14px] font-medium hover:bg-[#008f72] shrink-0"
                >
                  <FileText className="w-4 h-4" />
                  Choose template
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f0f2f5] border-b-[6px] border-[#00a884] text-center px-8">
          <div className="w-20 h-20 rounded-full bg-[#d1d7db]/20 flex items-center justify-center mb-5">
            <MessageSquarePlus className="w-10 h-10 text-[#00a884]" />
          </div>
          <h2 className="text-[32px] font-light text-[#41525d]">WhatsApp Business Inbox</h2>
          <p className="mt-3 max-w-md text-[14px] text-[#667781] leading-relaxed">
            Select a chat to read messages. When the 24-hour window is closed, send an approved template —
            the preview shows exactly how WhatsApp will display it.
          </p>
        </div>
      )}

      {/* Contact drawer */}
      {isNoteDrawerOpen && activeConv && (
        <div className="w-80 bg-white border-l border-[#d1d7db] flex flex-col shrink-0">
          <div className="h-[60px] px-4 bg-[#008069] text-white flex items-center gap-3 shrink-0">
            <button type="button" onClick={() => setIsNoteDrawerOpen(false)} className="p-1">
              <X className="w-5 h-5" />
            </button>
            <span className="font-medium">Contact info</span>
          </div>
          <div className="p-6 flex flex-col items-center bg-[#f0f2f5] border-b border-[#e9edef]">
            <div className="wa-avatar w-28 h-28 text-4xl mb-3">{contactInitial(activeConv.contactId?.name)}</div>
            <p className="text-[20px] text-[#111b21] font-medium">{activeConv.contactId?.name}</p>
            <p className="text-[14px] text-[#667781] font-mono mt-1">{activeConv.contactId?.phone}</p>
            <Badge variant="green" size="xs" className="mt-2">
              {activeConv.contactId?.leadStage || 'new'}
            </Badge>
          </div>
          <div className="p-4 space-y-3 text-sm border-b border-[#e9edef]">
            <label className="block text-[12px] text-[#667781]">Assigned agent</label>
            <select
              value={activeConv.assignedAgentId?._id || activeConv.assignedAgentId || ''}
              onChange={(e) => handleAssignAgent(e.target.value)}
              className="w-full px-3 py-2 bg-[#f0f2f5] rounded-lg text-[14px] outline-none"
            >
              <option value="">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h5 className="text-[12px] font-semibold text-[#667781] uppercase">Notes</h5>
            {activeConv.contactId?.notes?.length === 0 ? (
              <p className="text-[#667781] text-xs italic">No notes yet.</p>
            ) : (
              activeConv.contactId?.notes?.map((n, i) => (
                <div key={i} className="p-3 bg-[#f0f2f5] rounded-lg text-[13px]">
                  <p className="text-[#111b21]">{n.text}</p>
                  <p className="text-[11px] text-[#667781] mt-1">
                    {n.authorName} · {formatDate(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleAddNote} className="p-3 border-t border-[#e9edef]">
            <input
              type="text"
              placeholder="Add a note..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-[#f0f2f5] rounded-lg mb-2 outline-none"
            />
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              Add note
            </Button>
          </form>
        </div>
      )}

      {/* Template modal with live WhatsApp preview */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Send WhatsApp template"
        size="2xl"
        contentClassName="min-h-[70vh]"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="whatsapp"
              onClick={handleSendTemplate}
              disabled={
                !selectedTemplate ||
                sending ||
                (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(selectedTemplate?.header?.format) &&
                  !isUsableMediaRef(headerMediaUrl))
              }
              isLoading={sending}
            >
              Send on WhatsApp
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-[65vh]">
          {/* Left: pick + configure */}
          <div className="space-y-4 min-w-0 flex flex-col">
            <div className="flex flex-col min-h-0 flex-1">
              <label className="block text-[12px] font-semibold text-[#667781] uppercase mb-2">
                Approved templates
              </label>
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl._id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(tmpl);
                      setTemplateParams({});
                      const usable = isUsableMediaRef(tmpl.header?.mediaUrl) ? tmpl.header.mediaUrl : '';
                      setHeaderMediaUrl(usable);
                      setHeaderText(tmpl.header?.text || '');
                    }}
                    className={`w-full p-3 border rounded-xl text-left text-xs transition-colors ${
                      selectedTemplate?._id === tmpl._id
                        ? 'border-[#00a884] bg-[#e7fce3]'
                        : 'border-[#e9edef] hover:bg-[#f0f2f5]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {tmpl.header?.format === 'IMAGE' && isUsableMediaRef(tmpl.header?.mediaUrl) && (
                        <img
                          src={getMediaUrl(tmpl.header.mediaUrl)}
                          alt=""
                          className="w-11 h-11 rounded-lg object-cover border border-[#e9edef]"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#111b21] truncate">{tmpl.name}</span>
                          {tmpl.header?.format && tmpl.header.format !== 'NONE' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#d9fdd3] text-[#008069] rounded">
                              {tmpl.header.format}
                            </span>
                          )}
                          <Badge variant="green" size="xs">
                            {tmpl.category}
                          </Badge>
                        </div>
                        <p className="text-[#667781] line-clamp-2 mt-0.5">{tmpl.body?.text}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedTemplate && (
              <div className="space-y-3 pt-2 border-t border-[#e9edef]">
                {selectedTemplate.header?.format === 'IMAGE' && (
                  <div className="p-3 bg-[#f0f2f5] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#111b21] flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-[#00a884]" /> Image header
                      </span>
                      <span className="text-[11px] text-[#667781]">JPG / PNG · max 5MB</span>
                    </div>
                    <p className="text-[11px] text-[#667781]">
                      Upload the logo/image WhatsApp will show above the message. Do not use sample CDN
                      links.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="file"
                        ref={headerFileInputRef}
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleHeaderFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => headerFileInputRef.current?.click()}
                        isLoading={uploadingHeaderMedia}
                        icon={UploadCloud}
                      >
                        Upload image
                      </Button>
                      <input
                        type="text"
                        placeholder="Or public HTTPS image URL"
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#d1d7db] rounded-lg outline-none focus:border-[#00a884]"
                      />
                    </div>
                  </div>
                )}

                {selectedTemplate.header?.format === 'DOCUMENT' && (
                  <div className="p-3 bg-[#f0f2f5] rounded-xl space-y-2">
                    <span className="text-xs font-bold text-[#111b21] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#00a884]" /> Document header (PDF)
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="file"
                        ref={headerFileInputRef}
                        accept="application/pdf"
                        onChange={handleHeaderFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => headerFileInputRef.current?.click()}
                        isLoading={uploadingHeaderMedia}
                        icon={UploadCloud}
                      >
                        Upload PDF
                      </Button>
                      <input
                        type="text"
                        placeholder="Or public PDF URL"
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#d1d7db] rounded-lg outline-none"
                      />
                    </div>
                  </div>
                )}

                {selectedTemplate.header?.format === 'VIDEO' && (
                  <div className="p-3 bg-[#f0f2f5] rounded-xl space-y-2">
                    <span className="text-xs font-bold text-[#111b21] flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#00a884]" /> Video header
                    </span>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="file"
                        ref={headerFileInputRef}
                        accept="video/mp4,video/3gpp"
                        onChange={handleHeaderFileUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => headerFileInputRef.current?.click()}
                        isLoading={uploadingHeaderMedia}
                        icon={UploadCloud}
                      >
                        Upload video
                      </Button>
                      <input
                        type="text"
                        placeholder="Or public video URL"
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#d1d7db] rounded-lg outline-none"
                      />
                    </div>
                  </div>
                )}

                {selectedTemplate.header?.format === 'TEXT' &&
                  (selectedTemplate.header.text?.match(/\{\{\d+\}\}/g) || []).length > 0 && (
                    <div className="p-3 bg-[#f0f2f5] rounded-xl space-y-2">
                      <label className="block text-xs font-bold text-[#111b21]">Header text</label>
                      <input
                        type="text"
                        placeholder="Header title"
                        value={headerText}
                        onChange={(e) => setHeaderText(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#d1d7db] rounded-lg"
                      />
                    </div>
                  )}

                {(selectedTemplate.body?.text?.match(/\{\{(\d+)\}\}/g) || []).length > 0 && (
                  <div className="p-3 bg-[#f0f2f5] rounded-xl space-y-2">
                    <h5 className="font-bold text-[#111b21] text-xs">Body variables</h5>
                    {[
                      ...new Set(
                        (selectedTemplate.body.text.match(/\{\{(\d+)\}\}/g) || []).map((m) =>
                          parseInt(m.replace(/\D/g, ''), 10)
                        )
                      )
                    ]
                      .filter((n) => !Number.isNaN(n))
                      .sort((a, b) => a - b)
                      .map((varNum) => (
                        <div key={varNum}>
                          <label className="block text-xs font-medium text-[#54656f] mb-1">
                            {`{{${varNum}}}`} <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder={
                              selectedTemplate.body.sampleVariables?.[varNum - 1] || 'Value'
                            }
                            value={templateParams[varNum] || ''}
                            onChange={(e) =>
                              setTemplateParams({ ...templateParams, [varNum]: e.target.value })
                            }
                            className="w-full px-3 py-1.5 text-xs bg-white border border-[#d1d7db] rounded-lg outline-none focus:border-[#00a884]"
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: live WhatsApp preview by type */}
          <div className="min-w-0 lg:sticky lg:top-0 self-start">
            {selectedTemplate ? (
              <WhatsAppTemplatePreview
                template={selectedTemplate}
                headerMediaUrl={headerMediaUrl}
                headerText={headerText}
                templateParams={templateParams}
              />
            ) : (
              <div className="wa-preview-frame h-full min-h-[320px] flex items-center justify-center text-[#667781] text-sm">
                Select a template to see the WhatsApp preview
              </div>
            )}
            {selectedTemplate && (
              <p className="mt-2 text-[11px] text-[#667781] leading-relaxed">
                Preview matches WhatsApp rendering for{' '}
                <strong>{selectedTemplate.header?.format || 'TEXT'}</strong> header
                {selectedTemplate.buttons?.length
                  ? ` and ${selectedTemplate.buttons.length} button(s)`
                  : ''}
                .
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Media modal */}
      <Modal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        title="Send photo or document"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsMediaModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="whatsapp"
              onClick={handleSendMedia}
              disabled={!mediaFile || sending}
              isLoading={sending}
            >
              Send
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setMediaFile(e.target.files[0])}
            className="w-full text-xs text-[#54656f] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#e7fce3] file:text-[#008069]"
          />
          <input
            type="text"
            placeholder="Add a caption..."
            value={mediaCaption}
            onChange={(e) => setMediaCaption(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#f0f2f5] rounded-lg outline-none"
          />
        </div>
      </Modal>
    </div>
  );
};

export default InboxPage;
