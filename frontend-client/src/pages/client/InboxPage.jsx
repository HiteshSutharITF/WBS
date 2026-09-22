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
  Plus
} from 'lucide-react';
import { chatService } from '../../services/chatService';
import { contactService } from '../../services/contactService';
import { templateService } from '../../services/templateService';
import { userService } from '../../services/userService';
import { getSocket } from '../../utils/socket';
import { formatTime, formatDate, getMediaUrl } from '../../utils/formatters';
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
              m._id === messageId ? { ...m, status, errorCode, errorMessage } : m
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

  // Send Template Message
  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    try {
      const paramsArray = Object.keys(templateParams)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => templateParams[k]);

      await chatService.sendTemplateMessage(activeConvId, selectedTemplate._id, paramsArray);
      setIsTemplateModalOpen(false);
      setSelectedTemplate(null);
      setTemplateParams({});
      loadActiveChat(activeConvId);
    } catch (err) {
      alert(err.message);
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
                      {msg.messageType === 'image' && msg.mediaUrl && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                          <img
                            src={getMediaUrl(msg.mediaUrl)}
                            alt="WhatsApp attachment"
                            className="max-h-60 w-auto object-cover"
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
                          <span>
                            {msg.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-300 inline" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 inline" />
                            ) : msg.status === 'failed' ? (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-300 inline" title={msg.errorMessage} />
                            ) : (
                              <Check className="w-3.5 h-3.5 inline" />
                            )}
                          </span>
                        )}
                      </div>
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
                        : 'More than 24 hours have elapsed since the customer last replied. Meta policy requires sending an approved Template Message to re-open the conversation window.'}
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

      {/* Template Picker Modal (SOP compliant) */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Send Pre-Approved WhatsApp Template"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSendTemplate} disabled={!selectedTemplate || sending} isLoading={sending}>
              Send Template
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Select Template</label>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {templates.map((tmpl) => (
                <div
                  key={tmpl._id}
                  onClick={() => {
                    setSelectedTemplate(tmpl);
                    setTemplateParams({});
                  }}
                  className={`p-3 border rounded-xl cursor-pointer text-xs transition-colors ${
                    selectedTemplate?._id === tmpl._id
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{tmpl.name}</span>
                    <Badge variant="green" size="xs">{tmpl.category}</Badge>
                  </div>
                  <p className="text-slate-600 line-clamp-2">{tmpl.body.text}</p>
                </div>
              ))}
            </div>
          </div>

          {selectedTemplate && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h5 className="font-bold text-slate-800 text-xs">Configure Template Variables</h5>
              {/* Parse {{1}}, {{2}} in template */}
              {(selectedTemplate.body.text.match(/\{\{\d+\}\}/g) || []).map((match, idx) => {
                const varNum = idx + 1;
                return (
                  <div key={varNum}>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Variable {`{{${varNum}}}`}
                    </label>
                    <input
                      type="text"
                      placeholder={`e.g. ${selectedTemplate.body.sampleVariables?.[idx] || 'Value'}`}
                      value={templateParams[varNum] || ''}
                      onChange={(e) => setTemplateParams({ ...templateParams, [varNum]: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                );
              })}
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
