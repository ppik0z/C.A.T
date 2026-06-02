export default {
  settings: {
    header: {
      appTitle: 'Chatchoi',
      title: 'Cài đặt',
      online: 'Trực tuyến',
    },
    tabs: {
      appearance: {
        label: 'Giao diện',
        summary: 'Theme, font, độ nén chat',
      },
      language: {
        label: 'Ngôn ngữ & Khu vực',
        summary: 'Ngôn ngữ, thời gian',
      },
      general: {
        label: 'Cài đặt chung',
        summary: 'Điều hướng, media',
      },
      privacy: {
        label: 'Quyền riêng tư',
        summary: 'Trạng thái, bảo mật',
      },
      account: {
        label: 'Tài khoản',
        summary: 'Hồ sơ, bảo mật',
      },
      notifications: {
        label: 'Thông báo',
        summary: 'Âm báo, preview',
      },
    },
    appearance: {
      theme: {
        title: 'Chủ đề',
        description: 'Chọn preset màu cho toàn bộ giao diện chat.',
      },
      typography: {
        title: 'Phông chữ',
        description: 'Tối ưu cảm giác đọc bằng các phông chữ phổ biến.',
        size: 'Kích thước',
        fontOptions: {
          jakarta: { label: 'Plus Jakarta', description: 'Gọn, hiện đại' },
          lexend: { label: 'Lexend', description: 'Rõ chữ, dễ đọc' },
          inter: { label: 'Inter', description: 'Phổ biến, rõ ràng' },
          roboto: { label: 'Roboto', description: 'Cổ điển' },
          opensans: { label: 'Open Sans', description: 'Dễ nhìn' },
          system: { label: 'System', description: 'Nhanh nhất' },
        },
        sizeOptions: {
          small: { label: 'Nhỏ', description: '14px' },
          medium: { label: 'Vừa', description: '16px' },
          large: { label: 'Lớn', description: '18px' },
          extraLarge: { label: 'Rất lớn', description: '20px' },
        },
      },
      livePreview: {
        title: 'Xem trước trực tiếp',
        description: 'Áp dụng lựa chọn trên mẫu hội thoại.',
      },
    },
    languageRegion: {
      title: 'Ngôn ngữ & Khu vực',
      description: 'Thiết lập ngôn ngữ và định dạng thời gian hiển thị.',
      appLanguage: {
        title: 'Ngôn ngữ ứng dụng',
        description: 'Ngôn ngữ chính cho giao diện.',
        vi: 'Tiếng Việt',
        en: 'English',
      },
      timezone: {
        title: 'Múi giờ',
        description: 'Múi giờ của bạn.',
      },
      timeFormat: {
        title: 'Định dạng giờ',
        description: 'Định dạng giờ trong danh sách chat và tin nhắn.',
      },
      datePreview: {
        title: 'Xem trước ngày',
        description: 'Mẫu hiển thị ngày trong trạng thái hiện tại.',
      },
    },
    general: {
      title: 'Cài đặt chung',
      description: 'Các tuỳ chọn mặc định khi mở ứng dụng.',
      startupView: {
        title: 'Màn hình khởi động',
        description: 'Màn hình đầu tiên sau khi đăng nhập.',
        messages: 'Tin nhắn',
        friends: 'Bạn bè',
      },
      sidebarStyle: {
        title: 'Kiểu thanh bên',
        description: 'Cách thanh điều hướng desktop mở rộng.',
        hover: 'Lướt qua',
        icons: 'Biểu tượng',
      },
      autoplayMedia: {
        title: 'Tự phát media',
        description: 'Tự chạy GIF và video preview trong cuộc trò chuyện.',
      },
      reduceMotion: {
        title: 'Giảm chuyển động',
        description: 'Giảm chuyển động ở các vùng giao diện phụ.',
      },
    },
    privacy: {
      title: 'Quyền riêng tư',
      description: 'Kiểm soát trạng thái và thông tin hiển thị với người khác.',
      activeStatus: {
        title: 'Trạng thái hoạt động',
        description: 'Cho bạn bè thấy khi tài khoản đang online.',
      },
      readReceipts: {
        title: 'Đã xem tin nhắn',
        description: 'Hiển thị trạng thái đã xem trong đoạn chat.',
      },
      profileVisibility: {
        title: 'Hiển thị hồ sơ',
        description: 'Cho phép người khác xem hồ sơ rút gọn.',
      },
      messageRequests: {
        title: 'Tin nhắn chờ',
        description: 'Ai có thể gửi tin nhắn mới tới tài khoản này.',
        everyone: 'Mọi người',
        friends: 'Chỉ bạn bè',
        none: 'Không ai',
      },
    },
    account: {
      title: 'Tài khoản',
      description: 'Thông tin hồ sơ và bảo mật tài khoản.',
      badge: 'Tài khoản Chatchoi',
      displayName: {
        title: 'Tên hiển thị',
        description: 'Tên hiển thị trong cuộc trò chuyện.',
        action: 'Chỉnh sửa',
      },
      password: {
        title: 'Mật khẩu',
        description: 'Cập nhật mật khẩu và bảo vệ đăng nhập.',
        action: 'Thay đổi',
      },
      sessions: {
        title: 'Phiên đăng nhập',
        description: 'Quản lý thiết bị đang đăng nhập.',
        action: 'Kiểm tra',
      },
      logout: {
        title: 'Đăng xuất',
        description: 'Thoát phiên đăng nhập trên thiết bị này.',
        action: 'Đăng xuất',
      },
    },
    notifications: {
      title: 'Thông báo',
      description: 'Điều chỉnh mức độ thông báo cho tin nhắn mới.',
      pushDevice: {
        title: 'Thông báo đẩy trên thiết bị này',
        description: 'Nhận thông báo khi ChatChoi chạy nền hoặc đã đóng.',
        denied: 'Trình duyệt đang chặn thông báo. Hãy cấp lại quyền trong cài đặt trình duyệt.',
        unsupported: 'Trình duyệt này chưa hỗ trợ FCM Web.',
      },
      messagePreview: {
        title: 'Xem trước tin nhắn',
        description: 'Hiển thị nội dung rút gọn trong thông báo.',
      },
      sound: {
        title: 'Âm thanh',
        description: 'Phát âm báo khi có tin nhắn mới.',
      },
      level: {
        title: 'Mức độ thông báo',
        description: 'Mức ưu tiên thông báo trong các đoạn chat.',
        all: 'Tất cả tin nhắn',
        mentions: 'Lượt nhắc đến',
        muted: 'Tắt tiếng',
      },
      quietHours: {
        title: 'Giờ yên tĩnh',
        description: 'Tạm dừng âm báo trong khoảng thời gian nghỉ.',
      },
    },
    common: {
      youHaveUnsavedChanges: 'Bạn có thay đổi chưa lưu!',
      reset: 'Hủy bỏ',
      applyChanges: 'Lưu thay đổi',
    },
  },
};
