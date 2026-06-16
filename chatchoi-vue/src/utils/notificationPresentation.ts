import {
  Bell,
  MessageSquare,
  PhoneMissed,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from '@lucide/vue';
import type { Component } from 'vue';

/** Icon đại diện theo loại thông báo, dùng chung cho toast và trung tâm thông báo. */
export const iconForNotification = (type: string): Component => {
  switch (type) {
    case 'friend.request': return UserPlus;
    case 'friend.accept': return UserCheck;
    case 'group.added': return Users;
    case 'group.removed': return UserMinus;
    case 'call.missed': return PhoneMissed;
    case 'chat.message':
    case 'chat.mention': return MessageSquare;
    default: return Bell;
  }
};

/** Thời gian tương đối kiểu Messenger: "Vừa xong", "5 phút", "3 giờ", "2 ngày". */
export const formatRelativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSeconds = Math.max(Math.floor((Date.now() - then) / 1000), 0);

  if (diffSeconds < 60) return 'Vừa xong';
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} tuần`;
  return new Date(then).toLocaleDateString('vi-VN');
};

export type NotificationDateGroup = 'today' | 'earlier';

/** Nhóm thông báo theo mốc thời gian để hiển thị tiêu đề mục (Hôm nay / Trước đó). */
export const dateGroupOf = (iso: string): NotificationDateGroup => {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return isToday ? 'today' : 'earlier';
};

export const dateGroupLabel: Record<NotificationDateGroup, string> = {
  today: 'Hôm nay',
  earlier: 'Trước đó',
};
