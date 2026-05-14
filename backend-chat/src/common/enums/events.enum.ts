// backend-chat/src/common/enums/events.enum.ts

export enum SocketEvents {
    // CÁC SỰ KIỆN CLIENT BẮN LÊN SERVER
    JOIN_ROOM = 'join_room',
    SEND_MESSAGE = 'send_message',
    LOAD_MESSAGES = 'load_messages',
    MARK_AS_READ = 'mark_as_read',
    HEARTBEAT = 'heartbeat',

    // CÁC SỰ KIỆN SERVER PHÁT VỀ CLIENT
    NEW_MESSAGE = 'new_message',
    UPDATE_CONVERSATION_LIST = 'update_conversation_list',
    SYNC_READ_STATE = 'sync_read_state',
    USER_STATUS_CHANGED = 'user_status_changed',
    INITIAL_PRESENCE_SYNC = 'initial_presence_sync',
    ERROR = 'error'
}