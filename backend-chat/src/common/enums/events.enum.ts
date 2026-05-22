// backend-chat/src/common/enums/events.enum.ts

export enum SocketEvents {
    // CÁC SỰ KIỆN CLIENT BẮN LÊN SERVER
    JOIN_ROOM = 'join_room',
    SEND_MESSAGE = 'send_message',
    LOAD_MESSAGES = 'load_messages',
    SEARCH_MESSAGES = 'search_messages',
    MESSAGE_DELIVERED = 'message_delivered',
    MARK_AS_READ = 'mark_as_read',
    TYPING_START = 'typing_start',
    TYPING_STOP = 'typing_stop',
    HEARTBEAT = 'heartbeat',

    // CÁC SỰ KIỆN SERVER PHÁT VỀ CLIENT
    NEW_MESSAGE = 'new_message',
    UPDATE_CONVERSATION_LIST = 'update_conversation_list',
    MESSAGE_STATUS_UPDATED = 'message_status_updated',
    SEARCH_MESSAGES_SUCCESS = 'search_messages_success',
    SEARCH_MESSAGES_ERROR = 'search_messages_error',
    READ_STATE_UPDATED = 'read_state_updated',
    TYPING_STATE_CHANGED = 'typing_state_changed',
    SYNC_READ_STATE = 'sync_read_state',
    USER_STATUS_CHANGED = 'user_status_changed',
    INITIAL_PRESENCE_SYNC = 'initial_presence_sync',
    ERROR = 'error'
}
