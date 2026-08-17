// 移植自 FFBox `src/renderer/src/bridges/serviceBridge.ts`。
// 改动点：
//   1. 事件总线改用 npm `events`（Node EventEmitter 的 JS polyfill，RN 可直接使用），
//      保留 `on/off/emit/removeAllListeners` 同签名。
//   2. CryptoJS.SHA256 → expo-crypto `digestStringAsync`（connect 是 async，可 await）。
//   3. WebSocket 用 RN 内置的（全局可用）。
//   4. HTTP 方法全部原样保留。
import EventEmitter from 'events';
import * as Crypto from 'expo-crypto';
import { TypedEventEmitter } from '../common/utils';
import { FFBoxServiceEvent, FFBoxServiceEventApi, Frame, Notification, OutputParams, Task, TaskStatus, Permission, UserConfig, ServerSettingsData, WorkingStatus } from '../common/types';

export interface ServeiceBridgeEvent {
	connected: () => void;
	// manual=true 表示用户手动断开；false 表示意外掉线（由 store 决定是否自动重连）
	disconnected: (manual: boolean) => void;
	error: (reason: string) => void;
	message: (event: MessageEvent<any>) => void;
};

export enum ServiceBridgeStatus {
	Idle = 'Idle',
	Connecting = 'Connecting',
	Connected = 'Connected',
	Disconnected = 'Disconnected',
	Reconnecting = 'Reconnecting',
};

export class ServiceBridge extends (EventEmitter as unknown as new () => TypedEventEmitter<FFBoxServiceEvent & ServeiceBridgeEvent>) {
	private ws: WebSocket | null = null;
	public ip: string | undefined;
	public port: number | undefined;
	public username: string | undefined;
	public password: string | undefined;
	public status = ServiceBridgeStatus.Idle;
	public sessionId?: string;
	public permissions: Permission[] = [];
	/** 用户手动断开标记：置 true 时，ws.onclose 不会触发意外掉线行为 */
	private manualDisconnect = false;
	/** 本次连接是否已尝试过自动重连（限制意外掉线仅自动重连 1 次） */
	public reconnectAttempted = false;

	constructor(ip?: string, port?: number) {
		super();
		setTimeout(() => {
			if (ip && port) {
				this.connect(ip, port);
			}
		}, 0);
	}

	// #region HTTP 请求封装

	/**
	 * 发送 HTTP 请求
	 */
	public async httpRequest<T>(method: string, path: string, body?: any): Promise<T> {
		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (this.sessionId) {
			headers['Authorization'] = `Bearer ${this.sessionId}`;
		}
		const response = await fetch(`http://${this.ip}:${this.port}${path}`, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});
		if (!response.ok) {
			// throw new Error(`HTTP ${response.status}`);
		}
		const text = await response.text();
		try {
			return JSON.parse(text);
		} catch {
			return text as T;
		}
	}

	// #endregion

	// #region 连接/断开/WebSocket 监听

	public async connect(ip?: string, port?: number, username?: string, password?: string) {
		if (ip && port) {
			this.ip = ip;
			this.port = port;
		}
		// 保存用户名/密码，供掉线后 reConnectServer 复用
		if (username !== undefined) this.username = username;
		if (password !== undefined) this.password = password;
		if (this.status === ServiceBridgeStatus.Idle) {
			this.status = ServiceBridgeStatus.Connecting;
		} else if (this.status === ServiceBridgeStatus.Disconnected) {
			this.status = ServiceBridgeStatus.Reconnecting;
		} else {
			return;
		}

		const finalResult = await new Promise<boolean>(async (connectResult) => {
			// 1. 检查服务器版本
			console.log(`serviceBridge: 正在检查服务器版本 http://${this.ip}:${this.port}/api/v1/system/version`);
			const requestOK1 = await fetch(`http://${this.ip}:${this.port}/api/v1/system/version`, { method: 'get' })
				.then(() => true)
				.catch(() => false);
			if (!requestOK1) {
				this.emit('error', '连接失败：获取服务器版本失败（可能是前端与后端版本不匹配，或网络完全不通所致）');
				connectResult(false);
				return;
			}

			// 2. HTTP 登录获取 sessionId
			console.log(`serviceBridge: 正在登录 http://${this.ip}:${this.port}/api/v1/auth/login`);
			const passkey = password ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password) : '';
			const [loginSuccess, loginResult] = await new Promise<[boolean, any]>((resolve) => {
				fetch(`http://${this.ip}:${this.port}/api/v1/auth/login`, {
					method: 'post',
					body: JSON.stringify({
						username: username || '',
						passkey,
					}),
					headers: new Headers({
						'Content-Type': 'application/json'
					}),
				}).then((response) => {
					response.json().then((result) => {
						resolve([result.isSuccess, result]);
					}).catch(() => {
						resolve([false, null]);
					});
				}).catch(() => {
					resolve([false, null]);
				});
			});

			if (!loginSuccess) {
				if (loginResult?.isUserExist === false) {
					this.emit('error', '登录失败：用户名错误');
				} else {
					this.emit('error', '登录失败：密码错误');
				}
				connectResult(false);
				return;
			}

			this.sessionId = loginResult.sessionId;
			this.permissions = loginResult.permissions ?? [];
			console.log(`serviceBridge: 登录成功，sessionId: ${this.sessionId}, permissions: ${JSON.stringify(this.permissions)}`);

			// 3. 建立 WebSocket 连接（携带 sessionId）
			console.log(`serviceBridge: 正在连接 WebSocket ws://${this.ip}:${this.port}/?sessionId=${this.sessionId}`);
			const ws = new WebSocket(`ws://${this.ip}:${this.port}/?sessionId=${this.sessionId}`);
			this.ws = ws;
			const self = this;

			ws.onopen = function () {
				console.log(`serviceBridge: WebSocket 连接成功`);
				self.status = ServiceBridgeStatus.Connected;
				// 连接成功后，允许下次意外掉线再次自动重连
				self.reconnectAttempted = false;
				self.emit('connected');
				connectResult(true);
			};

			ws.onclose = function () {
				// close 事件在 error 事件后触发
				const byUser = self.manualDisconnect;
				self.manualDisconnect = false;
				if (self.status === ServiceBridgeStatus.Connected) {
					// 掉线
					self.status = ServiceBridgeStatus.Disconnected;
				} else {
					// 未连接成功，由 onerror 处理过，这里不需处理
				}
				self.sessionId = undefined;
				self.permissions = [];
				self.emit('disconnected', byUser);
			};

			ws.onerror = function () {
				self.emit('error', 'WebSocket 连接失败');
			};

			ws.onmessage = function (event) {
				self.handleWsEvents(event);
			};
		});

		if (!finalResult) {
			if (this.status === ServiceBridgeStatus.Connecting) {
				this.status = ServiceBridgeStatus.Idle;
			} else if (this.status === ServiceBridgeStatus.Reconnecting) {
				this.status = ServiceBridgeStatus.Disconnected;
			}
		}
	}

	public disconnect() {
		console.log(`serviceBridge: 正在断开服务器 ws://${this.ip}:${this.port}/`);
		// 标记为手动断开，防止 ws.onclose 被当作意外掉线触发自动重连
		this.manualDisconnect = true;
		this.ws?.close();
		this.ws = null;
		this.status = ServiceBridgeStatus.Idle;
	}

	/**
	 * 接受 service 事件入口（来自 ws.onmessage）
	 */
	private handleWsEvents(event: MessageEvent<any>) {
		const data: FFBoxServiceEventApi = JSON.parse(event.data);
		if (data.event === 'connected') {
			console.log(`serviceBridge: 收到 connected 事件`, data.payload);
		} else {
			// asyncListLength 等事件不在 typed 事件联合中，此处按需转发
			this.emit(data.event as any, data.payload as any);
		}
	}

	// #endregion

	// #region 流式请求

	/**
	 * 发送流式 HTTP 请求（用于缩略图等场景）
	 * 返回原始 Response 对象
	 */
	public fetchHttp(path: string, signal?: AbortSignal): Promise<Response> {
		const headers: Record<string, string> = {};
		if (this.sessionId) {
			headers['Authorization'] = `Bearer ${this.sessionId}`;
		}
		return fetch(`http://${this.ip}:${this.port}${path}`, { headers, signal });
	}

	// #endregion

	// #region 任务管理

	public taskAddBatch(filePaths: string[], outputParams?: OutputParams): Promise<number[]> {
		return this.httpRequest<number[]>('POST', '/api/v1/tasks', { filePaths, outputParams });
	}

	public taskCopy(id: number, count?: number): Promise<number> {
		return this.httpRequest<number>('POST', `/api/v1/tasks/${id}/copy`, { count });
	}

	public taskDelete(ids: number[]): Promise<void> {
		return this.httpRequest<void>('POST', '/api/v1/tasks/delete', { ids });
	}

	public taskStart(ids: number[]): Promise<void> {
		return this.httpRequest<void>('POST', '/api/v1/tasks/start', { ids });
	}

	public taskReady(ids: number[]): Promise<void> {
		return this.httpRequest<void>('POST', '/api/v1/tasks/ready', { ids });
	}

	public taskPause(ids: number[]): Promise<void> {
		return this.httpRequest<void>('POST', '/api/v1/tasks/pause', { ids });
	}

	public taskResume(ids: number[]): Promise<void> {
		return this.httpRequest<void>('POST', '/api/v1/tasks/resume', { ids });
	}

	public taskReset(ids: number[]): Promise<void> {
		return this.httpRequest<void>('POST', '/api/v1/tasks/reset', { ids });
	}

	public mergeUploaded(id: number, hashs: string[], fileBaseName: string, inputName?: string, fileTime?: { accessTime: number, createTime: number, modifyTime: number }): Promise<void> {
		return this.httpRequest<void>('POST', `/api/v1/tasks/${id}/merge-upload`, { hashs, fileBaseName, inputName, fileTime });
	}

	public setUploadStatus(id: number, isUploading: boolean): Promise<void> {
		return this.httpRequest<void>('PUT', `/api/v1/tasks/${id}/upload-status`, { isUploading });
	}

	public setParameters(ids: number[], params: OutputParams, fullyReplace: boolean): Promise<void> {
		return this.httpRequest<void>('PUT', `/api/v1/tasks/parameters`, { ids, params, fullyReplace });
	}

	public trailLimit_stopTranscoding(id: number, reason: 'media' | 'working', byFrontend?: boolean): Promise<void> {
		return this.httpRequest<void>('POST', `/api/v1/tasks/${id}/stop`, { reason });
	}

	// #endregion

	// #region 队列管理

	public queueStart(): Promise<void> {
		return this.httpRequest<void>('POST', '/api/v1/queue/start');
	}

	public queuePause(): Promise<void> {
		return this.httpRequest<void>('POST', '/api/v1/queue/pause');
	}

	// #endregion

	// #region 通知管理

	public deleteNotification(notificationId: number): Promise<void> {
		return this.httpRequest<void>('DELETE', `/api/v1/system/notifications/${notificationId}`);
	}

	// #endregion

	// #region 信息获取

	public getProperties(): Promise<any> {
		return this.httpRequest<any>('GET', '/api/v1/system/properties');
	}

	public getWorkingStatus(): Promise<{ workingStatus: WorkingStatus; progress: number }> {
		return this.httpRequest<{ workingStatus: WorkingStatus; progress: number }>('GET', '/api/v1/system/working-status');
	}

	public getTaskList(offset: number, size: number): Promise<{ tasks: Task[], totalCount: number }>;
	public getTaskList(offset: number, size: number, idOnly: true): Promise<{ taskIds: number[], totalCount: number }>;
	public getTaskList(offset: number, size: number, idOnly?: boolean): Promise<{ tasks: Task[], totalCount: number } | { taskIds: number[], totalCount: number }> {
		const idOnlyParam = idOnly ? '&idOnly=true' : '';
		return this.httpRequest<any>('GET', `/api/v1/tasks?offset=${offset}&size=${size}${idOnlyParam}`);
	}

	/**
	 * 按状态筛选任务 ID 列表
	 */
	public getTaskIdsByStatus(status: TaskStatus): Promise<{ taskIds: number[], totalCount: number }> {
		return this.httpRequest<any>('GET', `/api/v1/tasks?status=${status}`);
	}

	public getTaskOutputFiles(taskRunEntries: { taskId: number; runIndex?: number }[]): Promise<{ taskId: number; taskIndex: number; runIndex: number; outputIndex: number; filePath: string; fileBaseName: string; fileTime?: { accessTime: number; createTime: number; modifyTime: number } }[]> {
		return this.httpRequest<any>('POST', '/api/v1/tasks/output-files', { taskRunEntries });
	}

	public getMediaFrameInfo(id: number, fileIndex: number, videoStreamIndex: number, type?: 'fast' | 'full' | 'stop'): Promise<Frame[]> {
		return this.httpRequest<Frame[]>('POST', `/api/v1/tasks/${id}/frame-info`, { fileIndex, videoStreamIndex, type });
	}

	public getThumbnailStream(id: number, fileIndex: number, videoStreamIndex: number, width: number, height: number, density: 'M' | 'H', abortSignal: AbortSignal): Promise<Response> {
		return this.fetchHttp(`/api/v1/tasks/${id}/thumbnail-stream?fileIndex=${fileIndex}&videoStreamIndex=${videoStreamIndex}&width=${width}&height=${height}&density=${density}`, abortSignal);
	}

	public subscribeTasks(taskIds: number[]): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: 'subscribe', taskIds }));
		}
	}

	public unsubscribeTasks(taskIds: number[]): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: 'unsubscribe', taskIds }));
		}
	}

	public replaceSubscription(taskIds: number[]): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify({ type: 'replaceSubscription', taskIds }));
		}
	}

	public getTask(taskId: number): Promise<Task> {
		return this.httpRequest<Task>('GET', `/api/v1/tasks/${taskId}`);
	}

	public getTaskIndex(taskId: number): Promise<number> {
		return this.httpRequest<{ index: number }>('GET', `/api/v1/tasks/${taskId}/index`).then(r => r.index);
	}

	public getNotifications(): Promise<Notification[]> {
		return this.httpRequest<Notification[]>('GET', '/api/v1/system/notifications');
	}

	public getAVOptions(): Promise<any> {
		return this.httpRequest<any>('GET', '/api/v1/system/codecs');
	}

	// #endregion

	// #region 服务器配置与用户管理

	public getServerSettings(): Promise<ServerSettingsData> {
		return this.httpRequest<ServerSettingsData>('GET', '/api/v1/settings/server');
	}

	public setServerSettings(settings: Partial<ServerSettingsData>): Promise<void> {
		return this.httpRequest<void>('PUT', '/api/v1/settings/server', settings);
	}

	public getUsers(): Promise<UserConfig[]> {
		return this.httpRequest<UserConfig[]>('GET', '/api/v1/settings/users');
	}

	public setUsers(users: UserConfig[]): Promise<void> {
		return this.httpRequest<void>('PUT', '/api/v1/settings/users', users);
	}

	// #endregion
}
