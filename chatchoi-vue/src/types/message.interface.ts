
export interface Message {
  id: string | number; 
  conversationId: string | number;
  senderId: string | number;
  content: string;
  createdAt: string; 
  isRead?: boolean;  
}