import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  FileText,
  Play,
  ExternalLink,
  Phone,
  ImageOff,
  Mic,
  Reply,
  Camera,
  Video,
  SmilePlus,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { formatTime, getMediaUrl, isUsableMediaRef } from '../../utils/formatters';

const WA_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MEDIA_PLACEHOLDERS = new Set([
  '[IMAGE]',
  '[VIDEO]',
  '[DOCUMENT]',
  '[AUDIO]',
  '📷 Photo',
  '🎥 Video',
  '📄 Document',
  '🎵 Audio',
  'Photo',
  'Video',
  'Document',
  'Audio'
]);

export const canRenderMediaSrc = (value) => {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  if (/^\d+$/.test(v) && !v.includes('/')) return false;
  return isUsableMediaRef(v) || v.startsWith('/uploads') || v.startsWith('uploads/');
};

const isOutboundSender = (replyTo) =>
  replyTo?.direction === 'outbound' ||
  replyTo?.senderType === 'agent' ||
  replyTo?.senderType === 'bot';

export const resolveReplyAuthor = (replyTo, contactName = '') => {
  if (!replyTo) return '';
  if (replyTo.senderName && replyTo.senderName !== 'Customer') return replyTo.senderName;
  if (isOutboundSender(replyTo)) {
    return replyTo.senderType === 'bot' ? 'Chatbot' : 'You';
  }
  return contactName || replyTo.senderName || 'Customer';
};

export const isActualReply = (replyTo) => {
  if (!replyTo || typeof replyTo !== 'object') return false;
  const wamid = replyTo.wamid != null ? String(replyTo.wamid).trim() : '';
  const messageId = replyTo.messageId != null ? String(replyTo.messageId).trim() : '';
  return Boolean(wamid || messageId);
};

export const enrichReplyTo = (replyTo, messages = []) => {
  if (!isActualReply(replyTo)) return null;
  const id = replyTo.messageId ? String(replyTo.messageId) : '';
  const wamid = replyTo.wamid || '';
  const orig = (messages || []).find(
    (m) => (id && String(m._id) === id) || (wamid && m.wamid && m.wamid === wamid)
  );
  if (!orig) return replyTo;
  const mediaUrl = canRenderMediaSrc(replyTo.mediaUrl) ? replyTo.mediaUrl : orig.mediaUrl || replyTo.mediaUrl;
  return {
    ...replyTo,
    messageId: replyTo.messageId || orig._id,
    mediaUrl: mediaUrl || '',
    messageType:
      replyTo.messageType && replyTo.messageType !== 'text'
        ? replyTo.messageType
        : orig.messageType || replyTo.messageType,
    content: replyTo.content || orig.content || '',
    direction: replyTo.direction || orig.direction || '',
    senderType: replyTo.senderType || orig.senderType || ''
  };
};

const isLikelyFileName = (value) => {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return /\.(png|jpe?g|gif|webp|bmp|heic|pdf|docx?|xlsx?|zip|mp4|mov|webm)$/i.test(v) && !v.includes(' ');
};

const replyPreviewParts = (replyTo) => {
  const t = replyTo?.messageType || 'text';
  const raw = String(replyTo?.content || '').trim();
  const usableCaption =
    raw && !MEDIA_PLACEHOLDERS.has(raw) && !raw.startsWith('[') && !(t === 'image' && isLikelyFileName(raw))
      ? raw
      : '';

  if (t === 'image' || t === 'template') {
    return { icon: 'camera', label: usableCaption || 'Photo', showThumb: t === 'image' || !!replyTo?.mediaUrl };
  }
  if (t === 'video') return { icon: 'video', label: usableCaption || 'Video', showThumb: false };
  if (t === 'document') return { icon: 'doc', label: usableCaption || raw || 'Document', showThumb: false };
  if (t === 'audio') return { icon: 'audio', label: usableCaption || 'Audio', showThumb: false };
  return { icon: null, label: usableCaption || raw || 'Message', showThumb: false };
};

export const ReplyQuote = ({
  replyTo,
  contactName = '',
  onJump,
  className = ''
}) => {
  if (!isActualReply(replyTo)) return null;

  const who = resolveReplyAuthor(replyTo, contactName);
  const parts = replyPreviewParts(replyTo);
  const thumb =
    parts.showThumb && canRenderMediaSrc(replyTo.mediaUrl) ? getMediaUrl(replyTo.mediaUrl) : '';
  const isYou = who === 'You' || who === 'Chatbot';
  const clickable = typeof onJump === 'function' && (replyTo.messageId || replyTo.wamid);

  const Icon =
    parts.icon === 'camera'
      ? Camera
      : parts.icon === 'video'
        ? Video
        : parts.icon === 'doc'
          ? FileText
          : parts.icon === 'audio'
            ? Mic
            : null;

  const handleClick = (e) => {
    e.stopPropagation();
    if (clickable) onJump(replyTo);
  };

  const Tag = clickable ? 'button' : 'div';

  return (
    <Tag
      type={clickable ? 'button' : undefined}
      className={`wa-reply-quote ${isYou ? 'wa-reply-quote-you' : 'wa-reply-quote-peer'} ${clickable ? 'wa-reply-quote-clickable' : ''} ${className}`.trim()}
      onClick={clickable ? handleClick : undefined}
      title={clickable ? 'Go to message' : undefined}
    >
      <span className="wa-reply-quote-bar" aria-hidden />
      <span className="wa-reply-quote-body">
        <span className="wa-reply-quote-author">{who}</span>
        <span className="wa-reply-quote-text">
          {Icon ? <Icon className="wa-reply-quote-icon" aria-hidden /> : null}
          <span className="truncate">{parts.label}</span>
        </span>
      </span>
      {thumb ? <img src={thumb} alt="" className="wa-reply-quote-thumb" /> : null}
    </Tag>
  );
};

export const WaTicks = ({ status, errorMessage, dark = false }) => {
  if (status === 'failed') {
    return (
      <AlertCircle
        className={`w-3.5 h-3.5 inline ${dark ? 'text-amber-600' : 'text-amber-500'}`}
        title={errorMessage || 'Failed'}
      />
    );
  }
  if (status === 'read') {
    return <CheckCheck className="w-3.5 h-3.5 inline text-[#53bdeb]" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="w-3.5 h-3.5 inline text-[#667781]" />;
  }
  if (status === 'pending') {
    return <Clock className="w-3 h-3 inline text-[#667781]" />;
  }
  return <Check className="w-3.5 h-3.5 inline text-[#667781]" />;
};

const ReactionChips = ({ reactions = [], onOpenPicker }) => {
  if (!reactions.length) return null;
  const grouped = {};
  reactions.forEach((r) => {
    if (!r?.emoji) return;
    grouped[r.emoji] = (grouped[r.emoji] || 0) + 1;
  });
  const entries = Object.entries(grouped);
  if (!entries.length) return null;

  return (
    <button type="button" className="wa-reaction-chips" onClick={onOpenPicker} title="Reactions">
      {entries.map(([emoji, count]) => (
        <span key={emoji} className="wa-reaction-chip">
          <span>{emoji}</span>
          {count > 1 ? <span className="wa-reaction-count">{count}</span> : null}
        </span>
      ))}
    </button>
  );
};

export const WhatsAppTemplatePreview = ({
  template,
  headerMediaUrl = '',
  headerText = '',
  templateParams = {},
  contactName = 'Customer',
  showPhoneFrame = true
}) => {
  if (!template) return null;

  const headerFormat = template.header?.format || 'NONE';
  const resolveParam = (n) => {
    const v = templateParams[n] ?? templateParams[String(n)] ?? templateParams[Number(n)];
    if (v == null) return null;
    const s = String(v).trim();
    return s !== '' ? s : null;
  };

  const renderedBody = (template.body?.text || '').replace(/\{\{(\d+)\}\}/g, (_, num) => {
    return resolveParam(num) ?? `{{${num}}}`;
  });

  const renderedHeaderText = (() => {
    if (headerFormat !== 'TEXT') return '';
    const raw = template.header?.text || '';
    if (!raw) return headerText || '';
    return raw.replace(/\{\{(\d+)\}\}/g, () => (headerText && String(headerText).trim()) || '{{1}}');
  })();

  const buttons = Array.isArray(template.buttons) ? template.buttons : [];
  const hasMedia = isUsableMediaRef(headerMediaUrl);

  const bubble = (
    <div className="wa-bubble wa-bubble-out wa-template-bubble w-full max-w-[300px] shadow-sm">
      {headerFormat === 'IMAGE' && (
        <div className="wa-tpl-media">
          {hasMedia ? (
            <img
              src={getMediaUrl(headerMediaUrl)}
              alt="Header"
              className="w-full max-h-52 object-cover block"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const ph = e.currentTarget.parentElement?.querySelector('.wa-tpl-media-placeholder');
                if (ph) ph.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="wa-tpl-media-placeholder"
            style={hasMedia ? { display: 'none' } : undefined}
          >
            <ImageOff className="w-7 h-7 opacity-50" />
            <span>Header image</span>
            <span className="text-[10px] opacity-70">Upload required</span>
          </div>
        </div>
      )}

      {headerFormat === 'VIDEO' && (
        <div className="wa-tpl-media wa-tpl-video">
          {hasMedia ? (
            <video
              src={getMediaUrl(headerMediaUrl)}
              className="w-full max-h-52 object-cover block"
              muted
              playsInline
            />
          ) : (
            <div className="wa-tpl-media-placeholder">
              <Play className="w-8 h-8 opacity-80" />
              <span className="text-[10px]">Video header</span>
            </div>
          )}
          {hasMedia && (
            <div className="wa-tpl-play">
              <Play className="w-5 h-5 fill-white text-white" />
            </div>
          )}
        </div>
      )}

      {headerFormat === 'DOCUMENT' && (
        <div className="wa-tpl-doc">
          <div className="wa-tpl-doc-icon">
            <FileText className="w-6 h-6 text-[#e53935]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#111b21] truncate">
              {template.header?.sampleFileName || 'Document.pdf'}
            </p>
            <p className="text-[11px] text-[#667781]">PDF document</p>
          </div>
        </div>
      )}

      <div className="wa-tpl-body">
        {headerFormat === 'TEXT' && renderedHeaderText && (
          <p className="font-semibold text-[14px] text-[#111b21] mb-1 leading-snug">{renderedHeaderText}</p>
        )}
        <p className="text-[14.2px] text-[#111b21] whitespace-pre-wrap leading-[19px]">{renderedBody}</p>
        {template.footer?.text && (
          <p className="text-[12px] text-[#667781] mt-1.5 leading-snug">{template.footer.text}</p>
        )}
        <div className="wa-meta">
          <span className="wa-meta-time">12:00</span>
          <CheckCheck className="w-3.5 h-3.5 inline text-[#53bdeb]" />
        </div>
      </div>

      {buttons.length > 0 && (
        <div className="wa-tpl-buttons">
          {buttons.map((btn, idx) => (
            <div key={idx} className="wa-tpl-btn">
              {btn.type === 'URL' && <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
              {btn.type === 'PHONE_NUMBER' && <Phone className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{btn.text || btn.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!showPhoneFrame) return bubble;

  return (
    <div className="wa-preview-frame wa-preview-phone">
      <div className="wa-preview-chat-header">
        <div className="wa-avatar wa-avatar-sm">{(contactName?.[0] || 'C').toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-[#111b21] truncate leading-tight">{contactName || 'Customer'}</p>
          <p className="text-[12px] text-[#667781] leading-tight">WhatsApp preview</p>
        </div>
      </div>
      <div className="wa-chat-wallpaper wa-preview-wallpaper p-3 sm:p-4 flex justify-end items-start">
        {bubble}
      </div>
    </div>
  );
};

export const WhatsAppMessageBubble = ({
  msg,
  onReply,
  canReply = false,
  contactName = '',
  messages = [],
  onJumpToReply,
  onReact,
  onDelete,
  onPreviewImage,
  currentUserId
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen && !reactOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setReactOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen, reactOpen]);

  const isOutbound = msg.direction === 'outbound';
  const isBot = msg.senderType === 'bot';
  const deleted = !!msg.deletedForEveryone;
  const type = msg.messageType || 'text';
  const mediaSrc = !deleted && canRenderMediaSrc(msg.mediaUrl) ? getMediaUrl(msg.mediaUrl) : '';
  const hasImage = !deleted && (type === 'image' || (type === 'template' && msg.mediaUrl)) && mediaSrc;
  const imageMissing = !deleted && type === 'image' && !mediaSrc;
  const isDoc = !deleted && type === 'document';
  const isVideo = !deleted && type === 'video';
  const isAudio = !deleted && type === 'audio';
  const buttons = msg.templateData?.buttons || [];
  const replyTo = enrichReplyTo(msg.replyTo, messages);
  const hasReply = !deleted && isActualReply(replyTo);
  const reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
  const myReaction = reactions.find(
    (r) => r.actorType === 'agent' && currentUserId && String(r.actorId) === String(currentUserId)
  );

  const caption = deleted
    ? ''
    : msg.content &&
        !MEDIA_PLACEHOLDERS.has(msg.content) &&
        !(type === 'image' && isLikelyFileName(msg.content))
      ? msg.content
      : type === 'template'
        ? msg.content
        : hasImage || isVideo
          ? msg.content &&
            !msg.content.startsWith('[') &&
            !msg.content.startsWith('📷') &&
            !msg.content.startsWith('🎥') &&
            !(type === 'image' && isLikelyFileName(msg.content))
            ? msg.content
            : ''
          : MEDIA_PLACEHOLDERS.has(msg.content || '')
            ? ''
            : msg.content;

  const closeMenus = () => {
    setMenuOpen(false);
    setReactOpen(false);
  };

  const handleReact = (emoji) => {
    closeMenus();
    if (typeof onReact !== 'function') return;
    const next = myReaction?.emoji === emoji ? '' : emoji;
    onReact(msg, next);
  };

  return (
    <div
      id={msg._id ? `wa-msg-${msg._id}` : undefined}
      data-wamid={msg.wamid || undefined}
      className={`wa-msg-row group flex flex-col ${isOutbound ? 'items-end' : 'items-start'} mb-0.5`}
    >
      <div className={`flex items-end gap-1 max-w-full relative ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}>
        <div
          className={`wa-bubble ${isOutbound ? 'wa-bubble-out' : 'wa-bubble-in'} ${isBot ? 'wa-bubble-bot' : ''} ${deleted ? 'wa-bubble-deleted' : ''}`}
          ref={menuRef}
        >
          {isBot && !deleted && <span className="wa-bot-label">Chatbot</span>}
          {hasReply && (
            <ReplyQuote replyTo={replyTo} contactName={contactName} onJump={onJumpToReply} />
          )}

          {deleted ? (
            <p className="wa-msg-deleted-text">This message was deleted</p>
          ) : (
            <>
              {hasImage && (
                <button
                  type="button"
                  className="wa-msg-media wa-msg-media-btn"
                  onClick={() => onPreviewImage?.(mediaSrc)}
                  title="View image"
                >
                  <img
                    src={mediaSrc}
                    alt=""
                    className="max-h-64 w-full object-cover block rounded-[6px]"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.wa-media-fallback-inline');
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="wa-media-fallback wa-media-fallback-inline" style={{ display: 'none' }}>
                    <ImageOff className="w-5 h-5 opacity-70" />
                    <span>Image unavailable</span>
                  </div>
                </button>
              )}

              {imageMissing && (
                <div className="wa-media-fallback">
                  <ImageOff className="w-5 h-5 opacity-70" />
                  <span>Photo (not available)</span>
                </div>
              )}

              {isVideo &&
                (mediaSrc ? (
                  <div className="wa-msg-media relative">
                    <video src={mediaSrc} className="max-h-64 w-full object-cover block rounded-[6px]" controls />
                  </div>
                ) : (
                  <div className="wa-media-fallback">
                    <Play className="w-5 h-5 opacity-70" />
                    <span>Video (not available)</span>
                  </div>
                ))}

              {isDoc && (
                <div className="wa-tpl-doc mb-1">
                  <div className="wa-tpl-doc-icon">
                    <FileText className="w-5 h-5 text-[#e53935]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#111b21] truncate">
                      {msg.content && !msg.content.startsWith('[') ? msg.content : 'Document'}
                    </p>
                    <p className="text-[11px] text-[#667781]">
                      {mediaSrc ? (
                        <a href={mediaSrc} target="_blank" rel="noreferrer" className="text-[#027eb5]">
                          Open file
                        </a>
                      ) : (
                        'Document'
                      )}
                    </p>
                  </div>
                </div>
              )}

              {isAudio &&
                (mediaSrc ? (
                  <audio controls src={mediaSrc} className="w-full max-w-[240px] my-1" />
                ) : (
                  <div className="wa-media-fallback">
                    <Mic className="w-5 h-5 opacity-70" />
                    <span>Audio (not available)</span>
                  </div>
                ))}

              {caption && type !== 'document' && <p className="wa-msg-text whitespace-pre-wrap">{caption}</p>}

              {type === 'template' && buttons.length > 0 && (
                <div className="wa-tpl-buttons -mx-1 mt-1">
                  {buttons.map((btn, idx) => (
                    <div key={idx} className="wa-tpl-btn">
                      <span className="truncate">{btn.text || 'Button'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="wa-meta">
            <span className="wa-meta-time">{formatTime(msg.sentAt || msg.createdAt)}</span>
            {isOutbound && !deleted && <WaTicks status={msg.status} errorMessage={msg.errorMessage} dark />}
          </div>

          {!deleted && (
            <ReactionChips reactions={reactions} onOpenPicker={() => setReactOpen(true)} />
          )}

          {reactOpen && !deleted && (
            <div className={`wa-reaction-picker ${isOutbound ? 'wa-reaction-picker-out' : 'wa-reaction-picker-in'}`}>
              {WA_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`wa-reaction-emoji ${myReaction?.emoji === emoji ? 'is-active' : ''}`}
                  onClick={() => handleReact(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {menuOpen && !deleted && (
            <div className={`wa-msg-menu ${isOutbound ? 'wa-msg-menu-out' : 'wa-msg-menu-in'}`}>
              {canReply && typeof onReply === 'function' && (
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    onReply(msg);
                  }}
                >
                  <Reply className="w-4 h-4" /> Reply
                </button>
              )}
              {typeof onReact === 'function' && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReactOpen(true);
                  }}
                >
                  <SmilePlus className="w-4 h-4" /> React
                </button>
              )}
              {typeof onDelete === 'function' && (
                <button
                  type="button"
                  className="wa-msg-menu-danger"
                  onClick={() => {
                    closeMenus();
                    onDelete(msg);
                  }}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>

        {!deleted && (
          <div className="wa-msg-actions opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
            {canReply && typeof onReply === 'function' && (
              <button type="button" onClick={() => onReply(msg)} className="wa-reply-btn" title="Reply">
                <Reply className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setReactOpen(false);
                setMenuOpen((v) => !v);
              }}
              className="wa-reply-btn"
              title="Message options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {isOutbound && msg.status === 'failed' && !deleted && (
        <p className="mt-1 max-w-[320px] text-[11px] text-[#ea0038] px-1">
          Not delivered{msg.errorMessage ? `: ${msg.errorMessage}` : ''}
        </p>
      )}
    </div>
  );
};

export default WhatsAppMessageBubble;
