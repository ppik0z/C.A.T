import type { CallKind } from '../types/call';
import type { ChatMessage } from '../types/chat';

export interface CallEventPresentation {
  kind: CallKind;
  title: string;
  detail: string;
  isMissed: boolean;
  isOutgoing: boolean;
}

export const getCallEventPresentation = (
  message: ChatMessage,
  currentUserId: number | null,
): CallEventPresentation => {
  const event = message.callEvent;
  const fallbackKind = message.content.toLocaleLowerCase('vi').includes('video') ? 'video' : 'audio';

  if (!event) {
    return {
      kind: fallbackKind,
      title: message.content || getCallKindLabel(fallbackKind),
      detail: '',
      isMissed: false,
      isOutgoing: message.senderId === currentUserId,
    };
  }

  const isOutgoing = event.startedByUserId === currentUserId;
  const isMissed = event.currentUserStatus === 'missed'
    || (event.status === 'missed' && !isOutgoing);
  const title = getCallEventTitle(event.kind, event.status, isOutgoing, isMissed);
  const direction = isOutgoing ? 'Bạn gọi đi' : 'Cuộc gọi đến';
  const duration = formatCallDuration(event.durationSeconds);

  return {
    kind: event.kind,
    title,
    detail: duration ? `${direction} · ${duration}` : direction,
    isMissed,
    isOutgoing,
  };
};

const getCallEventTitle = (
  kind: CallKind,
  status: 'ended' | 'missed' | 'cancelled',
  isOutgoing: boolean,
  isMissed: boolean,
) => {
  if (isMissed) return 'Cuộc gọi nhỡ';
  if (status === 'missed' && isOutgoing) return 'Không trả lời';
  if (status === 'cancelled') return 'Cuộc gọi đã hủy';
  return getCallKindLabel(kind);
};

const getCallKindLabel = (kind: CallKind) => {
  return kind === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
};

const formatCallDuration = (durationSeconds: number) => {
  if (durationSeconds <= 0) return '';
  if (durationSeconds < 60) return `${durationSeconds} giây`;

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  if (seconds === 0) return `${minutes} phút`;
  return `${minutes} phút ${seconds} giây`;
};
