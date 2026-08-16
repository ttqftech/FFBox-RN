/** 服务器连接状态 */
export enum ServiceBridgeStatus {
  Idle = 'Idle',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Disconnected = 'Disconnected',
  Reconnecting = 'Reconnecting',
}

/** 权限枚举（对齐 FFBox @common/types） */
export enum Permission {
  UserManagement = 'userManagement',
  ServerSettings = 'serverSettings',
  CacheManagement = 'cacheManagement',
  FileSystem = 'fileSystem',
}

/** 登录响应 */
export interface LoginResult {
  isUserExist: boolean;
  isSuccess: boolean;
  sessionId?: string;
  permissions?: Permission[];
}