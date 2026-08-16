import { ConnectHandle } from './minConnect';

/**
 * 当前连接句柄（本步临时，步骤 2 建立 appStore 后由 store 取代）。
 * 组件卸载后（如跳转主界面）仍可读取，用于检测掉线。
 */
export let currentConnect: ConnectHandle | null = null;

export function setCurrentConnect(handle: ConnectHandle | null) {
  currentConnect = handle;
}
