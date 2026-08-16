import * as Crypto from 'expo-crypto';
import { Permission, ServiceBridgeStatus } from '../common/types';

/**
 * 最小连接逻辑（本步临时实现，步骤 2 将由完整的 ServiceBridge 取代）。
 * 与 FFBox serviceBridge.connect 流程一致：
 *   1. HTTP 探测版本  GET  /api/v1/system/version
 *   2. HTTP 登录       POST /api/v1/auth/login（passkey = SHA256(password)）
 *   3. 建立 WebSocket  ws://{ip}:{port}/?sessionId={sessionId}
 */

/** 对应 FFBox ServiceBridge */
export interface ConnectHandle {
  ip: string;
  port: number;
  sessionId: string;
  permissions: Permission[];
  status: ServiceBridgeStatus;
  close: () => void;
}

export interface ConnectCallbacks {
  /** WebSocket 掉线 */
  onDisconnect?: () => void;
  /** 连接过程中的错误（失败原因） */
  onError?: (reason: string) => void;
}

/** 超时封装：毫秒后 abort */
function withTimeout(timeoutMs: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

/**
 * 探测 + 登录 + 建立 WebSocket。
 * 失败时抛出 Error（message 为面向用户的原因）；成功后返回 ConnectHandle。
 */
export async function testConnect(
  ip: string,
  port: string,
  username: string,
  password: string,
  callbacks: ConnectCallbacks = {}
): Promise<ConnectHandle> {
  const base = `http://${ip}:${port}`;

  // 1. 检查服务器版本
  const probe = withTimeout(8000);
  let version = '';
  try {
    const res = await fetch(`${base}/api/v1/system/version`, { signal: probe.signal });
    version = (await res.text()) || '';
  } catch {
    throw new Error('无法访问服务器：请检查 IP 与端口，或确认服务器已启动');
  } finally {
    probe.cancel();
  }

  // 2. HTTP 登录换取 sessionId
  const passkey = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  const login = withTimeout(8000);
  let loginResult: { isUserExist: boolean; isSuccess: boolean; sessionId?: string; permissions?: Permission[] };
  try {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username || '', passkey }),
      signal: login.signal,
    });
    loginResult = await res.json();
  } catch {
    throw new Error('登录失败：无法连接服务器');
  } finally {
    login.cancel();
  }

  if (!loginResult.isSuccess) {
    throw new Error(loginResult.isUserExist === false ? '登录失败：用户名错误' : '登录失败：密码错误');
  }

  // 3. 建立 WebSocket
  let ws: WebSocket | null = null;
  const handle: ConnectHandle = {
    ip,
    port: Number(port),
    sessionId: loginResult.sessionId!,
    permissions: loginResult.permissions ?? [],
    status: ServiceBridgeStatus.Connecting,
    close: () => ws?.close(),
  };

  await new Promise<void>((resolve, reject) => {
    ws = new WebSocket(`ws://${ip}:${port}/?sessionId=${handle.sessionId}`);

    ws.onopen = () => {
      handle.status = ServiceBridgeStatus.Connected;
      resolve();
    };
    ws.onerror = () => {
      handle.status = ServiceBridgeStatus.Disconnected;
      reject(new Error('WebSocket 连接失败'));
    };
    ws.onclose = () => {
      if (handle.status === ServiceBridgeStatus.Connected) {
        handle.status = ServiceBridgeStatus.Disconnected;
        callbacks.onDisconnect?.();
      } else {
        handle.status = ServiceBridgeStatus.Disconnected;
        callbacks.onError?.('WebSocket 连接失败');
      }
    };
  }).catch((err) => {
    callbacks.onError?.(err.message);
    throw err;
  });

  console.log(`FFa0x: 连接成功 ${ip}:${port}，版本 ${version}，sessionId ${handle.sessionId}`);
  return handle;
}
