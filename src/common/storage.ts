import AsyncStorage from '@react-native-async-storage/async-storage';

/** 一个服务器连接信息（对应 FFBox 的 serversInfo） */
export interface ServerInfo {
  ip: string;
  port: string;
  username: string;
  password: string;
}

const SERVERS_INFO_KEY = 'serversInfo';

/** 读取最近使用的服务器列表 */
export async function getServersInfo(): Promise<ServerInfo[]> {
  try {
    const raw = await AsyncStorage.getItem(SERVERS_INFO_KEY);
    return raw ? (JSON.parse(raw) as ServerInfo[]) : [];
  } catch {
    return [];
  }
}

/** 保存最近使用的服务器列表 */
export async function saveServersInfo(list: ServerInfo[]): Promise<void> {
  await AsyncStorage.setItem(SERVERS_INFO_KEY, JSON.stringify(list));
}
