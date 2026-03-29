export const GatewayEvents = {
    // 클라이언트 → 서버
    AUTHENTICATE: 'authenticate',
    TYPING_START: 'typing:start',
    TYPING_STOP: 'typing:stop',
    BLE_DETECTED: 'ble:detected',
  
    // 서버 → 클라이언트
    AUTHENTICATED: 'authenticated',
    FRIEND_REQUEST_RECEIVED: 'friend:request:received',
    FRIEND_REQUEST_ACCEPTED: 'friend:request:accepted',
    GUESTBOOK_REQUEST_RECEIVED: 'guestbook:request:received',
    GUESTBOOK_REQUEST_REJECTED: 'guestbook:request:rejected',
    GUESTBOOK_COMPLETED: 'guestbook:completed',
    GUESTBOOK_TYPING_START: 'guestbook:typing:start',
    GUESTBOOK_TYPING_STOP: 'guestbook:typing:stop',
    BLE_DETECTED_RESULT: 'ble:detected:result',
    ERROR: 'error',
  } as const;