export default {
  settings: {
    header: {
      appTitle: 'Chatchoi',
      title: 'Settings',
      online: 'Online',
    },
    tabs: {
      appearance: {
        label: 'Appearance',
        summary: 'Theme, font, chat density',
      },
      language: {
        label: 'Language & Region',
        summary: 'Language, timezone',
      },
      general: {
        label: 'General',
        summary: 'Navigation, media',
      },
      privacy: {
        label: 'Privacy',
        summary: 'Status, visibility',
      },
      account: {
        label: 'Account',
        summary: 'Profile, security',
      },
      notifications: {
        label: 'Notifications',
        summary: 'Sounds, preview',
      },
    },
    appearance: {
      theme: {
        title: 'Theme',
        description: 'Choose a color preset for the chat interface.',
      },
      typography: {
        title: 'Typography',
        description: 'Optimize reading comfort with popular fonts.',
        size: 'Size',
        fontOptions: {
          jakarta: { label: 'Plus Jakarta', description: 'Clean, modern' },
          lexend: { label: 'Lexend', description: 'Clear, legible' },
          inter: { label: 'Inter', description: 'Popular, sharp' },
          roboto: { label: 'Roboto', description: 'Classic' },
          opensans: { label: 'Open Sans', description: 'Easy reading' },
          system: { label: 'System', description: 'Fastest' },
        },
        sizeOptions: {
          small: { label: 'Small', description: '14px' },
          medium: { label: 'Medium', description: '16px' },
          large: { label: 'Large', description: '18px' },
          extraLarge: { label: 'Extra Large', description: '20px' },
        },
      },
      livePreview: {
        title: 'Live preview',
        description: 'Apply selection on sample conversation.',
      },
    },
    languageRegion: {
      title: 'Language & Region',
      description: 'Set language and time formatting.',
      appLanguage: {
        title: 'App language',
        description: 'Main language for interface.',
        vi: 'Tiếng Việt',
        en: 'English',
      },
      timezone: {
        title: 'Timezone',
        description: 'Your local timezone.',
      },
      timeFormat: {
        title: 'Time format',
        description: 'Time display in chat lists and messages.',
      },
      datePreview: {
        title: 'Date preview',
        description: 'Date display pattern under current status.',
      },
    },
    general: {
      title: 'General',
      description: 'Default options when opening the app.',
      startupView: {
        title: 'Startup view',
        description: 'First screen after login.',
        messages: 'Messages',
        friends: 'Friends',
      },
      sidebarStyle: {
        title: 'Sidebar style',
        description: 'How the desktop navigation expands.',
        hover: 'Hover',
        icons: 'Icons',
      },
      autoplayMedia: {
        title: 'Autoplay media',
        description: 'Autoplay GIFs and video previews in chat.',
      },
      reduceMotion: {
        title: 'Reduce motion',
        description: 'Reduce animations in secondary interface areas.',
      },
    },
    privacy: {
      title: 'Privacy',
      description: 'Control status and visible information to others.',
      activeStatus: {
        title: 'Active status',
        description: 'Show friends when your account is online.',
      },
      readReceipts: {
        title: 'Read receipts',
        description: 'Show seen status in conversations.',
      },
      profileVisibility: {
        title: 'Profile visibility',
        description: 'Allow others to see brief profile.',
      },
      messageRequests: {
        title: 'Message requests',
        description: 'Who can send new messages to this account.',
        everyone: 'Everyone',
        friends: 'Friends only',
        none: 'No one',
      },
    },
    account: {
      title: 'Account',
      description: 'Profile information and account security.',
      badge: 'Chatchoi account',
      displayName: {
        title: 'Display name',
        description: 'Name displayed in chats.',
        action: 'Edit',
      },
      password: {
        title: 'Password',
        description: 'Update password and protect login.',
        action: 'Change',
      },
      sessions: {
        title: 'Sessions',
        description: 'Manage logged-in devices.',
        action: 'Review',
      },
      logout: {
        title: 'Logout',
        description: 'Sign out of this device.',
        action: 'Logout',
      },
    },
    notifications: {
      title: 'Notifications',
      description: 'Adjust notification levels for new messages.',
      messagePreview: {
        title: 'Message preview',
        description: 'Show brief content in notifications.',
      },
      sound: {
        title: 'Sound',
        description: 'Play sound for new messages.',
      },
      level: {
        title: 'Notification level',
        description: 'Notification priority in chats.',
        all: 'All messages',
        mentions: 'Mentions',
        muted: 'Muted',
      },
      quietHours: {
        title: 'Quiet hours',
        description: 'Pause notification sounds during rest periods.',
      },
    },
    common: {
      youHaveUnsavedChanges: 'You have unsaved changes!',
      reset: 'Reset',
      applyChanges: 'Apply changes',
    },
  },
};
