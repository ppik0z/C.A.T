const BASE_URL = 'http://localhost:3000';

/**
 * Hàm Helper dùng chung để gọi API
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Lỗi kết nối API');
  }

  return response.json() as Promise<T>;
}

export const apiService = {
  // Auth
  login: (credentials: any) => 
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  
  // Conversations
  getConversations: () => 
    request<any[]>('/conversations'),
  
  // Messages
  getMessages: (conversationId: number) => 
    request<any[]>(`/messages/${conversationId}`),
};