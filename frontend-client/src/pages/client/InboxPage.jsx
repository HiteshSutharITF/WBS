import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Send,
  Paperclip,
  Clock,
  UserCheck,
  Bot,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  User,
  Phone,
  Tag,
  StickyNote,
  ChevronRight,
  RefreshCw,
  Plus,
  UploadCloud,
  Sparkles
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
import Alert from '../../components/common/Alert';

const formatRemainingWindow = (hours, minutes) => {
  if (!hours && !minutes) return 'Expired';
  const h = Math.floor(hours || 0);
  const m = Math.round((minutes || 0) % 60);
  if (h > 0) {
    return `${h}h ${m}m left`;
  }
  return `${m}m left`;
};

const InboxPage = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeData, setActiveData] = useState(null); // { conversation, messages }
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [templates, setTemplates] = useState([]);

  // Modals
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

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch Conversations
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

  // 2. Fetch Team and Templates for pickers
  useEffect(() => {
    userService.listTeamMembers().then((res) => setTeamMembers(res.data || [])).catch(() => {});
    templateService.listTemplates({ status: 'APPROVED' }).then((res) => setTemplates(res.data || [])).catch(() => {});
  }, []);

  // 3. Load Active Conversation
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
      loadActiveChat(activeConvId);
    }
  }, [activeConvId]);

  // 4. Socket Real-Time Listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (newMsg) => {
      // If belongs to currently viewed conversation, append to thread
      const isInbound = newMsg.direction === 'inbound';

      // If belongs to currently viewed conversation, append to thread and open window if inbound
      if (activeConvId && newMsg.conversationId === activeConvId) {
        setActiveData((prev) => {
          if (!prev) return prev;
          const exists = prev.messages.some((m) => m._id === newMsg._id || (m.wamid && m.wamid === newMsg.wamid));
          const updatedMessages = exists ? prev.messages : [...prev.messages, newMsg];
          return {
            ...prev,
            conversation: isInbound
              ? {
                  ...prev.conversation,
                  isWindowOpen: true,
                  hasCustomerMessaged: true,
                  sessionStatus: 'ACTIVE',
                  windowExpiresInHours: 24,
                  windowExpiresInMinutes: 1440
                }
              : prev.conversation,
            messages: updatedMessages
          };
        });
        setTimeout(scrollToBottom, 100);
      }

      // Update conversations list preview
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id === newMsg.conversationId) {
            return {
              ...c,
              lastMessageText: newMsg.content || `[${newMsg.messageType.toUpperCase()}]`,
              lastMessageAt: newMsg.createdAt,
              isWindowOpen: isInbound ? true : c.isWindowOpen,
              hasCustomerMessaged: isInbound ? true : c.hasCustomerMessaged,
              sessionStatus: isInbound ? 'ACTIVE' : c.sessionStatus,
              windowExpiresInHours: isInbound ? 24 : c.windowExpiresInHours
            };
          }
          return c;
        })
      );
    };

    const handleStatusUpdate = ({ messageId, status, errorCode, errorMessage }) => {
      if (activeData?.messages) {
        setActiveData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
      messages: prev.messages.map((m) =>
            String(m._id) === String(messageId) ? { ...m, status, errorCode, errorMessage } : m
          )
          };
        });
      }
    };

    const handleConvUpdated = () => {
      fetchConversations();
    };

    socket.on('new_message', handleNewMessage);
    socket.on('conversation_message', (payload) => handleNewMessage(payload.message));
    socket.on('message_status_updated', handleStatusUpdate);
    socket.on('conversation_updated', handleConvUpdated);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('conversation_message', handleNewMessage);
      socket.off('message_status_updated', handleStatusUpdate);
      socket.off('conversation_updated', handleConvUpdated);
    };
  }, [activeConvId, activeData]);

  // Send Text Message
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

  // Upload Header Media for Template
  const handleHeaderFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeaderMedia(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await chatService.uploadMediaAsset(formData);
      if (res.data?.url) {
        setHeaderMediaUrl(res.data.url);
      }
    } catch (err) {
      alert('Failed to upload header media: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingHeaderMedia(false);
    }
  };

  // Send Template Message
  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;

    const headerFormat = selectedTemplate.header?.format;
    if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(headerFormat) && !isUsableMediaRef(headerMediaUrl)) {
      alert(
        `This template requires a ${headerFormat.toLowerCase()} header. Upload a file or paste a public HTTPS URL. Meta sample handles cannot be used when sending.`
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

  // Send Media Message
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

  // Toggle Bot Pause (Human Hand-off)
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

  // Assign Agent
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

  // Add Note
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

  return (
    <div className="h-[calc(100vh-8.5rem)] bg-white rounded-2xl border border-slate-200/80 shadow-xs flex overflow-hidden">
      {/* 1. Left Conversation List Panel */}
      <div className="w-80 md:w-96 border-r border-slate-200/80 flex flex-col shrink-0">
        {/* Search & Tabs */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search leads & messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex gap-1">
            {['all', 'open', 'pending', 'resolved'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition-colors ${
                  statusFilter === st ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No conversations found.
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv._id === activeConvId;
              const contact = conv.contactId;

              return (
                <div
                  key={conv._id}
                  onClick={() => setActiveConvId(conv._id)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {contact?.name || 'Unknown Lead'}
                        </span>
                        {conv.sessionStatus === 'ACTIVE' || (conv.isWindowOpen && conv.hasCustomerMessaged) ? (
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                            title={`24h Window Active (${Math.round(conv.windowExpiresInHours || 24)}h left)`}
                          />
                        ) : conv.sessionStatus === 'EXPIRED' ? (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                            title="24h Window Expired (Template Required)"
                          />
                        ) : (
                          <span
                            className="w-2 h-2 rounded-full bg-slate-300 ring-1 ring-slate-400/50 shrink-0"
                            title="No Inbound Message Yet (Template Required to Start)"
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{contact?.phone || 'No phone'}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 truncate mt-1.5">
                    {conv.lastMessageText || 'No messages yet'}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge variant={contact?.leadStage === 'qualified' ? 'green' : 'gray'} size="xs">
                      {contact?.leadStage || 'new'}
                    </Badge>
                    {conv.isBotPaused && (
                      <Badge variant="purple" size="xs">Human Mode</Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Middle & Right Chat Window */}
      {activeConv ? (
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
          {/* Active Chat Header */}
          <div className="h-16 px-6 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                {activeConv.contactId?.name?.[0] || 'L'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">{activeConv.contactId?.name}</h3>
                  <Badge variant="blue" size="xs">{activeConv.contactId?.leadStage || 'new'}</Badge>
                </div>
                <p className="text-xs text-slate-500 font-mono">{activeConv.contactId?.phone}</p>
              </div>
            </div>

            {/* Actions & Window Indicator */}
            <div className="flex items-center gap-3">
              {/* 24h Window Badge */}
              {activeConv.sessionStatus === 'ACTIVE' || (isWindowOpen && activeConv.hasCustomerMessaged) ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-full border border-emerald-200">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>24h Active ({formatRemainingWindow(activeConv.windowExpiresInHours, activeConv.windowExpiresInMinutes)})</span>
                </div>
              ) : activeConv.sessionStatus === 'EXPIRED' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-900 text-xs font-medium rounded-full border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>24h Expired (Template Required)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full border border-slate-200">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Session Inactive (Send Template to Start)</span>
                </div>
              )}

              {/* Bot Pause / Hand-off Button */}
              <button
                type="button"
                onClick={handleToggleBot}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 border ${
                  activeConv.isBotPaused
                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>{activeConv.isBotPaused ? 'Bot Paused (Human)' : 'Bot Active'}</span>
              </button>

              {/* Notes Drawer Toggle */}
              <button
                type="button"
                onClick={() => setIsNoteDrawerOpen(!isNoteDrawerOpen)}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                title="View Contact Details & Notes"
              >
                <StickyNote className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Message Thread Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {chatLoading ? (
              <div className="flex justify-center p-8">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              activeData?.messages?.map((msg) => {
                const isOutbound = msg.direction === 'outbound';
                const isBot = msg.senderType === 'bot';

                return (
                  <div
                    key={msg._id}
                    className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-lg rounded-2xl px-4 py-2.5 shadow-xs text-sm relative ${
                        isOutbound
                          ? isBot
                            ? 'bg-purple-600 text-white rounded-br-xs'
                            : 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                      }`}
                    >
                      {/* Sender label */}
                      {isBot && (
                        <span className="block text-[10px] font-bold text-purple-200 uppercase tracking-wide mb-1">
                          Automated Chatbot
                        </span>
                      )}

                      {/* Media Image / Document Preview */}
                      {(msg.messageType === 'image' || (msg.messageType === 'template' && msg.mediaUrl)) && msg.mediaUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                          <img
                            src={getMediaUrl(msg.mediaUrl)}
                            alt="WhatsApp attachment"
                            className="max-h-60 w-auto object-cover rounded-lg"
                          />
                        </div>
                      )}

                      {/* Content */}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>

                      {/* Timestamp & Status ticks */}
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                          isOutbound ? 'text-white/80' : 'text-slate-400'
                        }`}
                      >
                        <span>{formatTime(msg.sentAt || msg.createdAt)}</span>
                        {isOutbound && (
                          <span title={msg.status === 'failed' ? msg.errorMessage || 'Failed' : msg.status}>
                            {msg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-300 inline" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 inline" />
                            ) : msg.status === 'failed' ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-200 inline" />
                            ) : msg.status === 'pending' ? (
                              <Clock className="w-3.5 h-3.5 inline opacity-80" />
                            ) : (
                              <Check className="w-3.5 h-3.5 inline" />
                            )}
                          </span>
                        )}
                      </div>
                      {isOutbound && msg.status === 'failed' && (
                        <p className="mt-1.5 text-[10px] leading-snug text-amber-100/95 bg-black/20 rounded-lg px-2 py-1">
                          Not delivered: {msg.errorMessage || 'Media header rejected by WhatsApp. Re-send with a freshly uploaded image.'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 3. Reply / Input Box Area */}
          <div className="p-4 bg-white border-t border-slate-200/80 shrink-0">
            {isWindowOpen && activeConv?.hasCustomerMessaged ? (
              /* Free-Form Reply Input (24h Window Active) */
              <form onSubmit={handleSendText} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(true)}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Attach Image or Document"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors shrink-0"
                >
                  Send Template
                </button>

                <input
                  type="text"
                  placeholder="Type a message to reply on WhatsApp..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!textInput.trim() || sending}
                  isLoading={sending}
                  icon={Send}
                >
                  Send
                </Button>
              </form>
            ) : (
              /* 24-Hour Window Closed / Inactive Banner */
              <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-amber-900">
                    <p className="font-bold">
                      {!activeConv?.hasCustomerMessaged
                        ? '24-Hour Customer Window Not Started'
                        : '24-Hour Customer Service Window Closed'}
                    </p>
                    <p className="text-amber-800 mt-0.5 leading-relaxed">
                      {!activeConv?.hasCustomerMessaged
                        ? 'This contact has not sent an inbound message yet. Meta WhatsApp policy strictly requires sending an approved Template Message to initiate the conversation.'
                        : 'More than 24 hours have elapsed since the customer last replied. Free-form text and image replies are blocked — use Choose & Send Template. For IMAGE templates, upload the header image (logo) and fill all variables before sending.'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsTemplateModalOpen(true)}
                  icon={FileText}
                  className="shrink-0 whitespace-nowrap"
                >
                  Choose & Send Template
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Select a conversation to view chat history.
        </div>
      )}

      {/* 4. Notes & Contact Profile Side Drawer */}
      {isNoteDrawerOpen && activeConv && (
        <div className="w-80 border-l border-slate-200 bg-white p-5 flex flex-col shrink-0 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h4 className="font-bold text-slate-900 text-sm">Lead Details & Notes</h4>
            <button onClick={() => setIsNoteDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs">
              Close
            </button>
          </div>

          <div className="py-4 space-y-3 text-xs border-b border-slate-100">
            <div>
              <span className="text-slate-400">Lead Name</span>
              <p className="font-semibold text-slate-800 text-sm">{activeConv.contactId?.name}</p>
            </div>
            <div>
              <span className="text-slate-400">Phone Number</span>
              <p className="font-semibold text-slate-800 font-mono">{activeConv.contactId?.phone}</p>
            </div>
            <div>
              <span className="text-slate-400">Assigned Agent</span>
              <select
                value={activeConv.assignedAgentId?._id || activeConv.assignedAgentId || ''}
                onChange={(e) => handleAssignAgent(e.target.value)}
                className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            <h5 className="font-semibold text-slate-700 text-xs">Internal CRM Notes</h5>
            {activeConv.contactId?.notes?.length === 0 ? (
              <p className="text-slate-400 text-xs italic">No notes yet.</p>
            ) : (
              activeConv.contactId?.notes?.map((n, i) => (
                <div key={i} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                  <p className="text-slate-800">{n.text}</p>
                  <p className="text-[10px] text-slate-400">{n.authorName} &bull; {formatDate(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddNote} className="pt-3 border-t border-slate-100">
            <input
              type="text"
              placeholder="Add quick lead note..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl mb-2 focus:bg-white"
            />
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              Add Note
            </Button>
          </form>
        </div>
      )}

      {/* Template Picker Modal (SOP compliant with Media Header support) */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Send Pre-Approved WhatsApp Template"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSendTemplate}
              disabled={
                !selectedTemplate ||
                sending ||
                (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(selectedTemplate?.header?.format) &&
                  !isUsableMediaRef(headerMediaUrl))
              }
              isLoading={sending}
            >
              Send Template
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Select Template</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {templates.map((tmpl) => (
                <div
                  key={tmpl._id}
                  onClick={() => {
                    setSelectedTemplate(tmpl);
                    setTemplateParams({});
                    // Never pre-fill Meta header_handle values — they are not sendable media URLs
                    const usable = isUsableMediaRef(tmpl.header?.mediaUrl) ? tmpl.header.mediaUrl : '';
                    setHeaderMediaUrl(usable);
                    setHeaderText(tmpl.header?.text || '');
                  }}
                  className={`p-3 border rounded-xl cursor-pointer text-xs transition-colors ${
                    selectedTemplate?._id === tmpl._id
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {tmpl.header?.format === 'IMAGE' && isUsableMediaRef(tmpl.header?.mediaUrl) && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-100 mt-0.5">
                        <img
                          src={getMediaUrl(tmpl.header.mediaUrl)}
                          alt={tmpl.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate">{tmpl.name}</span>
                          {tmpl.header?.format && tmpl.header.format !== 'NONE' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-md">
                              {tmpl.header.format} HEADER
                            </span>
                          )}
                        </div>
                        <Badge variant="green" size="xs">{tmpl.category}</Badge>
                      </div>
                      <p className="text-slate-600 line-clamp-2">{tmpl.body.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedTemplate && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* 1. Header Media Configuration (Required if template has IMAGE, DOCUMENT, or VIDEO) */}
              {selectedTemplate.header?.format === 'IMAGE' && (
                <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <ImageIcon className="w-4 h-4 text-blue-600" /> Header Image (Required by Meta)
                    </span>
                    <span className="text-[11px] text-blue-600 font-medium">JPG, PNG • Max 5MB</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Upload the image that should appear above the template body (e.g. your logo). Do not use
                    WhatsApp sample preview links — Meta accepts them then fails delivery. Always click
                    &quot;Upload New Image&quot; before sending.
                  </p>

                  {/* Image Preview */}
                  {isUsableMediaRef(headerMediaUrl) && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white max-w-sm">
                      <img
                        src={getMediaUrl(headerMediaUrl)}
                        alt="Header Preview"
                        className="w-full h-36 object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-md backdrop-blur-xs">
                        Header Preview
                      </span>
                    </div>
                  )}

                  {/* Upload and URL input */}
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
                      className="shrink-0"
                    >
                      Upload New Image
                    </Button>
                    <input
                      type="text"
                      placeholder="Or enter public Image URL (https://...)"
                      value={headerMediaUrl}
                      onChange={(e) => setHeaderMediaUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {selectedTemplate.header?.format === 'DOCUMENT' && (
                <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <FileText className="w-4 h-4 text-blue-600" /> Header Document (PDF Required by Meta)
                    </span>
                    <span className="text-[11px] text-blue-600 font-medium">PDF • Max 100MB</span>
                  </div>
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
                      className="shrink-0"
                    >
                      Upload PDF
                    </Button>
                    <input
                      type="text"
                      placeholder="Or enter public PDF URL (https://...)"
                      value={headerMediaUrl}
                      onChange={(e) => setHeaderMediaUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {selectedTemplate.header?.format === 'VIDEO' && (
                <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                      <ImageIcon className="w-4 h-4 text-blue-600" /> Header Video (Required by Meta)
                    </span>
                    <span className="text-[11px] text-blue-600 font-medium">MP4 • Max 16MB</span>
                  </div>
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
                      className="shrink-0"
                    >
                      Upload Video
                    </Button>
                    <input
                      type="text"
                      placeholder="Or enter public Video URL (https://...)"
                      value={headerMediaUrl}
                      onChange={(e) => setHeaderMediaUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {selectedTemplate.header?.format === 'TEXT' && (selectedTemplate.header.text?.match(/\{\{\d+\}\}/g) || []).length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase">
                    Header Variable (Required)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter header title text"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              )}

              {/* 2. Configure Body Variables */}
              {(selectedTemplate.body.text.match(/\{\{(\d+)\}\}/g) || []).length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h5 className="font-bold text-slate-800 text-xs">Configure Template Variables</h5>
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
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Variable {`{{${varNum}}}`} <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder={`e.g. ${selectedTemplate.body.sampleVariables?.[varNum - 1] || 'Value'}`}
                          value={templateParams[varNum] || ''}
                          onChange={(e) => setTemplateParams({ ...templateParams, [varNum]: e.target.value })}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                          required
                        />
                      </div>
                    ))}
                </div>
              )}

              {/* 3. Live Message Preview */}
              <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide block mb-2">
                  WhatsApp Recipient Preview
                </span>
                <div className="bg-[#EFEAE2] p-3 rounded-xl max-w-sm shadow-xs">
                  <div className="bg-white rounded-lg p-2.5 shadow-xs space-y-2 text-xs">
                    {selectedTemplate.header?.format === 'IMAGE' && isUsableMediaRef(headerMediaUrl) && (
                      <img
                        src={getMediaUrl(headerMediaUrl)}
                        alt="Header"
                        className="w-full h-28 object-cover rounded-md"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    {selectedTemplate.header?.format === 'TEXT' && selectedTemplate.header.text && (
                      <p className="font-bold text-slate-900">
                        {headerText || selectedTemplate.header.text}
                      </p>
                    )}
                    <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {selectedTemplate.body.text.replace(/\{\{(\d+)\}\}/g, (_, num) => templateParams[num] || `{{${num}}}`)}
                    </p>
                    {selectedTemplate.footer?.text && (
                      <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-1">
                        {selectedTemplate.footer.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Media Upload Modal */}
      <Modal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        title="Upload & Send WhatsApp Media"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsMediaModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSendMedia} disabled={!mediaFile || sending} isLoading={sending}>
              Upload & Send
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Select Media File</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setMediaFile(e.target.files[0])}
              className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Caption (Optional)</label>
            <input
              type="text"
              placeholder="Add caption..."
              value={mediaCaption}
              onChange={(e) => setMediaCaption(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InboxPage;
