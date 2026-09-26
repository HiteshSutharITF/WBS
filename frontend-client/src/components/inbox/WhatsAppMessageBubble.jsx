import React from 'react';
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
  Mic
} from 'lucide-react';
import { formatTime, getMediaUrl, isUsableMediaRef } from '../../utils/formatters';

/** True when mediaUrl is a local upload / public https we can show in <img>. */
const canRenderMediaSrc = (value) => {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (!v) return false;
  // Meta media ids are numeric-ish and not paths
  if (/^\d+$/.test(v) && !v.includes('/')) return false;
  return isUsableMediaRef(v) || v.startsWith('/uploads') || v.startsWith('uploads/');
};

/** WhatsApp-style delivery ticks */
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
    return <CheckCheck className={`w-3.5 h-3.5 inline ${dark ? 'text-[#667781]' : 'text-[#667781]'}`} />;
  }
  if (status === 'pending') {
    return <Clock className={`w-3 h-3 inline ${dark ? 'text-[#667781]' : 'text-[#667781]'}`} />;
  }
  return <Check className={`w-3.5 h-3.5 inline ${dark ? 'text-[#667781]' : 'text-[#667781]'}`} />;
};

/**
 * Live WhatsApp template preview — mirrors how Meta/WhatsApp renders
 * IMAGE / VIDEO / DOCUMENT / TEXT headers + body + footer + buttons.
 */
export const WhatsAppTemplatePreview = ({
  template,
  headerMediaUrl = '',
  headerText = '',
  templateParams = {},
  showPhoneFrame = true
}) => {
  if (!template) return null;

  const headerFormat = template.header?.format || 'NONE';
  const renderedBody = (template.body?.text || '').replace(
    /\{\{(\d+)\}\}/g,
    (_, num) => (templateParams[num] != null && String(templateParams[num]).trim() !== ''
      ? String(templateParams[num])
      : `{{${num}}}`)
  );

  const renderedHeaderText = (() => {
    if (headerFormat !== 'TEXT') return '';
    const raw = template.header?.text || '';
    if (!raw) return headerText || '';
    return raw.replace(/\{\{(\d+)\}\}/g, () => headerText || '{{1}}');
  })();

  const buttons = Array.isArray(template.buttons) ? template.buttons : [];

  const bubble = (
    <div className="wa-bubble wa-bubble-out wa-template-bubble max-w-[280px] w-full shadow-sm">
      {headerFormat === 'IMAGE' && (
        <div className="wa-tpl-media">
          {isUsableMediaRef(headerMediaUrl) ? (
            <img
              src={getMediaUrl(headerMediaUrl)}
              alt="Header"
              className="w-full max-h-44 object-cover block"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="wa-tpl-media-placeholder">
              <span>Header image</span>
              <span className="text-[10px] opacity-70">Upload required</span>
            </div>
          )}
        </div>
      )}

      {headerFormat === 'VIDEO' && (
        <div className="wa-tpl-media wa-tpl-video">
          {isUsableMediaRef(headerMediaUrl) ? (
            <video
              src={getMediaUrl(headerMediaUrl)}
              className="w-full max-h-44 object-cover block"
              muted
              playsInline
            />
          ) : (
            <div className="wa-tpl-media-placeholder">
              <Play className="w-8 h-8 opacity-80" />
              <span className="text-[10px]">Video header</span>
            </div>
          )}
          <div className="wa-tpl-play">
            <Play className="w-5 h-5 fill-white text-white" />
          </div>
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
          <p className="font-semibold text-[14px] text-[#111b21] mb-1 leading-snug">
            {renderedHeaderText}
          </p>
        )}

        <p className="text-[14.2px] text-[#111b21] whitespace-pre-wrap leading-[19px]">
          {renderedBody}
        </p>

        {template.footer?.text && (
          <p className="text-[12px] text-[#667781] mt-1.5 leading-snug">{template.footer.text}</p>
        )}

        <div className="wa-meta">
          <span>Preview</span>
        </div>
      </div>

      {buttons.length > 0 && (
        <div className="wa-tpl-buttons">
          {buttons.map((btn, idx) => {
            const isUrl = btn.type === 'URL';
            const isPhone = btn.type === 'PHONE_NUMBER';
            return (
              <div key={idx} className="wa-tpl-btn">
                {isUrl && <ExternalLink className="w-3.5 h-3.5 shrink-0" />}
                {isPhone && <Phone className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{btn.text || btn.type}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!showPhoneFrame) return bubble;

  return (
    <div className="wa-preview-frame">
      <div className="wa-preview-label">WhatsApp preview</div>
      <div className="wa-chat-wallpaper wa-preview-wallpaper p-3 flex justify-end">
        {bubble}
      </div>
    </div>
  );
};

/** Chat thread bubble for any message type */
export const WhatsAppMessageBubble = ({ msg }) => {
  const isOutbound = msg.direction === 'outbound';
  const isBot = msg.senderType === 'bot';
  const type = msg.messageType || 'text';
  const mediaSrc = canRenderMediaSrc(msg.mediaUrl) ? getMediaUrl(msg.mediaUrl) : '';
  const hasImage = (type === 'image' || (type === 'template' && msg.mediaUrl)) && mediaSrc;
  const imageMissing = type === 'image' && !mediaSrc;
  const isDoc = type === 'document';
  const isVideo = type === 'video';
  const isAudio = type === 'audio';
  const buttons = msg.templateData?.buttons || [];
  const caption =
    msg.content &&
    !['[IMAGE]', '[VIDEO]', '[DOCUMENT]', '[AUDIO]', '📷 Photo', '🎥 Video', '📄 Document', '🎵 Audio'].includes(
      msg.content
    )
      ? msg.content
      : type === 'template'
        ? msg.content
        : hasImage || isVideo
          ? msg.content && !msg.content.startsWith('[') && !msg.content.startsWith('📷') && !msg.content.startsWith('🎥')
            ? msg.content
            : ''
          : msg.content;

  return (
    <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} mb-0.5`}>
      <div
        className={`wa-bubble ${isOutbound ? 'wa-bubble-out' : 'wa-bubble-in'} ${
          isBot ? 'wa-bubble-bot' : ''
        }`}
      >
        {isBot && <span className="wa-bot-label">Chatbot</span>}

        {hasImage && (
          <div className="wa-msg-media">
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
          </div>
        )}

        {imageMissing && (
          <div className="wa-media-fallback">
            <ImageOff className="w-5 h-5 opacity-70" />
            <span>Photo (not available)</span>
          </div>
        )}

        {isVideo && (
          mediaSrc ? (
            <div className="wa-msg-media relative">
              <video
                src={mediaSrc}
                className="max-h-64 w-full object-cover block rounded-[6px]"
                controls
              />
            </div>
          ) : (
            <div className="wa-media-fallback">
              <Play className="w-5 h-5 opacity-70" />
              <span>Video (not available)</span>
            </div>
          )
        )}

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

        {isAudio && (
          mediaSrc ? (
            <audio controls src={mediaSrc} className="w-full max-w-[240px] my-1" />
          ) : (
            <div className="wa-media-fallback">
              <Mic className="w-5 h-5 opacity-70" />
              <span>Audio (not available)</span>
            </div>
          )
        )}

        {caption && type !== 'document' && (
          <p className="wa-msg-text whitespace-pre-wrap">{caption}</p>
        )}

        {type === 'template' && buttons.length > 0 && (
          <div className="wa-tpl-buttons -mx-1 mt-1">
            {buttons.map((btn, idx) => (
              <div key={idx} className="wa-tpl-btn">
                <span className="truncate">{btn.text || 'Button'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="wa-meta">
          <span>{formatTime(msg.sentAt || msg.createdAt)}</span>
          {isOutbound && (
            <WaTicks status={msg.status} errorMessage={msg.errorMessage} dark />
          )}
        </div>
      </div>

      {isOutbound && msg.status === 'failed' && (
        <p className="mt-1 max-w-[320px] text-[11px] text-[#ea0038] px-1">
          Not delivered{msg.errorMessage ? `: ${msg.errorMessage}` : ''}
        </p>
      )}
    </div>
  );
};

export default WhatsAppMessageBubble;
