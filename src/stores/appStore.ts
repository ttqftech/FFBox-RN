// 移植自 FFBox `src/renderer/src/stores/appStore.ts`。
// 改动点：
//   1. Pinia `defineStore` → valtio `proxy`（组件用 `useSnapshot` 读取即可响应式）。
//   2. 移动端不存在的概念（globalParams / presetName / availablePresets 等）注释掉，保留原位置与顺序。
//   3. 移除 Popup / nodeBridge / i11n / gsap / 激活码等桌面端依赖，`pushMsg` 本地实现。
//   4. `updateTaskList` 简化：移动端不做无限滚动，一次性拉取首页任务。
import { proxy } from 'valtio';
import { Notification, NotificationLevel, OutputParams, TaskStatus, WorkingStatus } from '../common/types';
import { Server, UITask } from '../types';
import { ServiceBridge, ServiceBridgeStatus } from '../bridges/serviceBridge';
import { registerServerForDashboard } from '../common/dashboardCalc';
import { randomString, getInitialUITask, mergeTaskFromService } from '../common/utils';
import { handleCmdUpdate, handleFFmpegInfo, handleProgressUpdate, handleTasklistUpdate, handleNotificationUpdate, handleTaskUpdate, handleStatusUpdate } from '../logic/eventsHandler';
import { getLimitation } from '../common/limitations';

// #region store 状态与 actions（对齐 FFBox appStore 结构）

export const appStore = proxy({
	// ---- 界面类（移动端大多不适用，注释保留位置） ----
	// showMenuCenter: 0,
	// showInfoCenter: false,
	// showTransferCenter: false,
	// showTaskInfo: undefined,
	// showCutOperator: undefined,	// 裁切操作器（桌面端用 gsap 动画）
	// showDragFilesOverlay: false,
	// paraSelected: 1,
	// draggerPos: 0.57,
	// taskViewSettings: { ... }	// FFBox UI 概念（参数面板可见性），移动端无参数编辑界面，故注释
	// frontendSettings: { ... }	// 主题等桌面端设置，移动端暂不需要
	unreadNotificationCount: 0,
	// componentRefs: {},
	// ---- 非界面类 ----
	notifications: [] as Notification[],
	servers: [] as Server[],
	currentServerId: undefined as string | undefined,
	// 多选模式（移动端新增）：true 时进入选择模式，点任务=切换选中；undefined 表示非选择模式
	// 与 FFBox 的 selectedTask/isAllSelected 对齐：selectedTask 始终维护已选集合
	multiSelect: false,
	selectedTask: new Set<number>(),
	isAllSelected: false,
	taskSelectionModified: false,
	// 移动端无全局参数概念，保留位置但注释
	// globalParams: JSON.parse(JSON.stringify(defaultParams)) as OutputParams,
	// presetName: '',
	// availablePresets: [] as string[],
	// downloadMap: new Map<string, string>(),
	// latestVersion: undefined,
	functionLevel: 20,

	// #region getters
	get currentServer(): Server | undefined {
		return this.servers.find((server) => server.data.id === this.currentServerId);
	},
	get localServer(): Server | undefined {
		return this.servers.length && this.servers[0].entity.ip === 'localhost' ? this.servers[0] : undefined;
	},
	// #endregion

	// #region 辅助方法
	/**
	 * 根据 taskId 从当前服务器的 tasks 数组中查找任务
	 * @returns UITask 或 undefined（不在缓冲区中）
	 */
	getTaskById(taskId: number): UITask | undefined {
		const data = this.currentServer?.data;
		if (!data) return undefined;
		const index = data.taskIdToIndex.get(taskId);
		return index !== undefined ? data.tasks[index] : undefined;
	},
	// #endregion

	// #region 任务处理
	/**
	 * 从后端获取任务列表更新到本地。
	 * 移动端不做无限滚动：一次性拉取首页任务（totalCount 未知时拉 pageSize 条）。
	 * 既是初始化加载入口，也是列表刷新方法。
	 */
	async updateTaskList(): Promise<void> {
		const server = this.currentServer;
		if (!server) return;
		const pageSize = 200;
		const newStart = 0;
		// totalCount 未知（0 或未初始化）时先拉一页，用于获取总数
		const newEnd = server.data.totalCount > 0 ? Math.min(server.data.totalCount, pageSize) : pageSize;
		const size = newEnd - newStart;
		if (size <= 0) {
			await server.entity.getTaskList(0, 0).then((resp) => (server.data.totalCount = resp.totalCount));
			return;
		}

		const response = await server.entity.getTaskList(newStart, size);
		const { tasks, totalCount: newTotalCount } = response;
		server.data.totalCount = newTotalCount;

		// 构建旧任务临时 Map，用于合并保留已有的 dashboard 等状态
		const oldTasksById = new Map<number, UITask>();
		for (const task of server.data.tasks) oldTasksById.set(task.id, task);

		// 重建 tasks 数组和 taskIdToIndex 映射
		const newTasks: UITask[] = [];
		const newMap = new Map<number, number>();
		for (let i = 0; i < tasks.length; i++) {
			const task = tasks[i];
			const globalIndex = newStart + i;
			const existing = oldTasksById.get(task.id);
			if (existing) {
				mergeTaskFromService(existing, task, true);
				existing.taskIndex = globalIndex;
				newTasks.push(existing);
			} else {
				const uiTask = getInitialUITask(task.id, '');
				mergeTaskFromService(uiTask, task, true);
				uiTask.taskIndex = globalIndex;
				uiTask.selectedRunIndex = uiTask.runs.length - 1;
				newTasks.push(uiTask);
			}
			newMap.set(task.id, i);
		}
		server.data.tasks = newTasks;
		server.data.taskIdToIndex = newMap;

		// 更新缓冲区范围
		server.data.bufferStart = newStart;
		server.data.bufferEnd = newStart + tasks.length;

		// 订阅当前缓冲区的 taskId
		server.entity.replaceSubscription(newTasks.map((t) => t.id));
	},
	/**
	 * 从后端获取所有任务的 ID 列表（用于全选/跨区选择）
	 */
	async fetchAllTaskIds(): Promise<number[]> {
		if (!this.currentServer) return [];
		const server = this.currentServer;
		const totalCount = server.data.totalCount;
		if (totalCount === 0) return [];
		const response = await server.entity.getTaskList(0, totalCount, true);
		return response.taskIds;
	},
	/**
	 * 按状态从后端查询任务 ID 并设为选中集合
	 */
	async selectTasksByStatus(status: TaskStatus): Promise<number[]> {
		if (!this.currentServer) return [];
		const response = await this.currentServer.entity.getTaskIdsByStatus(status);
		this.selectedTask = new Set(response.taskIds);
		this.isAllSelected = false;
		this.taskSelectionModified = false;
		this.multiSelect = true;	// 移动端：按条件选择后进入多选模式
		return response.taskIds;
	},
	/**
	 * 进入/退出多选模式
	 */
	toggleMultiSelect() {
		this.multiSelect = !this.multiSelect;
		if (this.multiSelect) {
			// 进入选择模式时清空已选
			this.selectedTask = new Set();
			this.isAllSelected = false;
		} else {
			this.selectedTask = new Set();
		}
	},
	/**
	 * 反选全部任务（参考 ActionBar.handleSelectAllClick + 纲要 3.1.1）
	 * 反选后数量为 0 则退出选择模式
	 */
	async invertSelection() {
		const ids = await this.fetchAllTaskIds();
		const all = new Set(ids);
		for (const id of all) if (this.selectedTask.has(id)) all.delete(id);
		this.selectedTask = all;
		if (this.selectedTask.size === 0) {
			this.multiSelect = false;
			this.selectedTask = new Set();
		}
	},
	/**
	 * 退出多选模式
	 */
	exitMultiSelect() {
		this.multiSelect = false;
		this.selectedTask = new Set();
	},
	/**
	 * 获取 service 的 task 更新到本地
	 */
	updateTask(taskId: number) {
		const server = this.currentServer;
		if (!server) return;
		server.entity.getTask(taskId).then((content) => {
			handleTaskUpdate(server, taskId, content, true);
		});
	},
	/**
	 * 删除任务
	 */
	deleteTasks(taskIds: number[]) {
		if (!this.currentServer) return;
		const server = this.currentServer;
		for (const taskId of taskIds) {
			const uploadFiles = server.data.uploadFiles.filter((uploadFile) => uploadFile.taskId === taskId);
			for (const uploadFile of uploadFiles) {
				// 中断正在上传的分片
				for (const chunk of uploadFile.chunks) {
					if (chunk.status === 'uploading') chunk.abortController.abort();
				}
			}
		}
		server.entity.taskDelete(taskIds);
	},
	/**
	 * 开始/暂停队列
	 */
	startNpause() {
		if (!this.currentServer) return;
		const server = this.currentServer;
		if (server.entity.status !== ServiceBridgeStatus.Connected) return;
		if (server.data.workingStatus === WorkingStatus.idle) {
			server.entity.queueStart();
		} else {
			server.entity.queuePause();
		}
	},
	// 移动端无"全局参数"概念，以下参数处理相关 action 注释保留位置。
	// 但注意：checkAndApplyCodecDefaults 与 fetchAVOptions 未来仍可能用到——
	//   - fetchAVOptions：取出服务端 ffmpeg 的编码器/复用器/滤镜清单，用于组装参数编辑器表单项，后续步骤需恢复。
	//   - checkAndApplyCodecDefaults：切换编码器后重置 video/audio/mux 默认细节参数，参数编辑时大概率要恢复。
	// applyParameters(...) { ... },
	// checkAndApplyCodecDefaults(...) { ... },	// 后续参数编辑可能恢复
	// loadPreset(...) / savePreset(...) / editPreset(...) / deletePreset(...) / loadPresetList() { ... },
	// fetchAVOptions() { ... },	// 后续参数编辑需恢复，数据服务于参数编辑器表单项
	// FFBox UI 概念：计算 paramsVisibility 以决定参数面板各部分展开方式。
	// 移动端无参数编辑面板，且其依赖的 taskViewSettings 已注释，故本函数一并注释。
	// recalcChangedParams() {
	// 	if (!this.currentServer) return;
	// 	const paramsVisibility = { duration: 0, format: 0, smpte: 0, video: 0, audio: 0 };
	// 	for (const task of this.currentServer.data.tasks || []) {
	// 		const after = getTaskLatestOutputParams(task);
	// 		...
	// 	}
	// },
	// #endregion 任务处理

	// #region 通知处理
	/**
	 * 获取 service 的 notifications 更新到本地
	 */
	updateNotifications() {
		if (!this.currentServer) return;
		const entity = this.currentServer.entity;
		entity.getNotifications().then((result) => {
			this.currentServer!.data.notifications = result;
		});
	},
	pushMsg(message: string, level: NotificationLevel) {
		console.log(`[FFa0x] ${message}`);
		this.notifications.push({
			time: new Date().getTime(),
			content: message,
			level,
		});
	},
	setUnreadNotifationCount(clear = false) {
		this.unreadNotificationCount = clear ? 0 : this.unreadNotificationCount + 1;
	},
	// #endregion 通知处理

	// #region 服务器处理
	/**
	 * 获取 service 的版本和属性更新到本地
	 */
	updateServerProperties() {
		const server = this.currentServer;
		if (!server) return;
		Promise.all([
			fetch(`http://${server.entity.ip}:${server.entity.port}/api/v1/system/version`, { method: 'get' }),
			server.entity.getProperties(),
			server.entity.getWorkingStatus(),
		]).then(([versionResponse, properties, workingStatus]) => {
			(versionResponse as Response).text().then((text) => {
				server.data.version = text;
			});
			server.data.os = properties.os;
			server.data.isSandboxed = properties.isSandboxed;
			server.data.machineId = properties.machineId;
			server.data.functionLevel = properties.functionLevel;
			server.data.ffmpegInfo = properties.ffmpegInfo;

			if (typeof workingStatus === 'object' && workingStatus !== null && (workingStatus as any).workingStatus !== undefined) {
				const ws = workingStatus as { workingStatus: WorkingStatus; progress: number };
				if (ws.workingStatus === WorkingStatus.idle || ws.workingStatus === WorkingStatus.running) {
					server.data.workingStatus = ws.workingStatus;
					if (ws.workingStatus === WorkingStatus.running) registerServerForDashboard(server, 'start');
				}
				server.data.progress = ws.progress;
			}
		}).catch((e) => console.warn('[updateServerProperties] 失败', e));
	},
	/**
	 * 添加服务器（移动端仅一个连接，仍保留数组结构以对齐 FFBox）
	 */
	addServer() {
		const id = randomString(6);
		this.servers.push({
			data: {
				id,
				name: '未连接',
				tasks: [],
				taskIdToIndex: new Map(),
				notifications: [],
				uploadFiles: [],
				downloadFiles: [],
				ffmpegInfo: { version: '', scanning: false, videoEncodersCount: 0, audioEncodersCount: 0, muxersCount: 0, demuxersCount: 0, filtersCount: 0 },
				version: '',
				totalCount: 0,
				bufferStart: 0,
				bufferEnd: 0,
				viewRange: { firstIndex: 0, lastIndex: 0 },
				workingStatus: WorkingStatus.idle,
				progress: -1,
				asyncList: [],
			},
			entity: new ServiceBridge(),
		});
		this.selectedTask.clear();
		this.currentServerId = id;
		return id;
	},
	/**
	 * 关闭服务器
	 */
	removeServer(serverId: string) {
		const index = this.servers.findIndex((server) => server.data.id === serverId);
		if (index === -1) return;
		const server = this.servers[index];
		server.entity.disconnect();
		this.servers.splice(index, 1);
		if (this.currentServerId === serverId) {
			this.currentServerId = this.servers[index - 1]?.data.id;
		}
	},
	/**
	 * 初始化服务器连接并挂载事件监听
	 */
	initializeServer(serverId: string, ip: string, port: number, username: string, password: string, retryCount = 0): Promise<Server> {
		const server = this.servers.find((s) => s.data.id === serverId) as Server;
		const entity = server.entity;
		if (!ip) return Promise.reject('缺少 IP');
		const _port = port ?? 33269;
		console.log('初始化服务器连接', server.data);

		const destroy = () => {
			for (const eventName of ['connected', 'disconnected', 'error', 'ffmpegInfo', 'workingStatusUpdate', 'tasklistUpdate', 'taskUpdate', 'cmdUpdate', 'progressUpdate', 'notificationUpdate', 'asyncListUpdate'] as any[]) {
				entity.removeAllListeners(eventName);
			}
		};
		return new Promise((resolve, reject) => {
			entity.connect(ip, _port, username, password);

			entity.on('connected', () => {
				server.data.name = ip === 'localhost' ? '本地服务器' : ip;
				console.log(`成功连接到服务器 ${entity.ip}`);
				this.pushMsg(`成功连接到服务器 ${server.data.name}`, NotificationLevel.ok);
				server.data.tasks = [];
				server.data.taskIdToIndex = new Map();
				this.updateServerProperties();
				this.updateTaskList().then(() => this.updateTaskList());
				this.updateNotifications();
				resolve(server);
			});
			entity.on('disconnected', (manual: boolean) => {
				console.log(`已断开服务器 ${entity.ip} 的连接`);
				this.pushMsg(`已断开服务器 ${server.data.name} 的连接`, NotificationLevel.warning);
				// 仅意外掉线时自动重连 1 次；手动断开（manual=true）不重连。
				// 重连是否已尝试由实体层（entity.reconnectAttempted）维护，而非 ServerData。
				if (!manual && !entity.reconnectAttempted) {
					entity.reconnectAttempted = true;
					setTimeout(() => this.reConnectServer(serverId), 1000);
				}
				destroy();
			});
			entity.on('error', (reason: string) => {
				if (!retryCount || reason.includes('连接失败')) {
					console.log(`服务器 ${entity.ip} ${reason}`);
					this.pushMsg(`服务器 ${server.data.name} ${reason}`, NotificationLevel.error);
					destroy();
					reject(reason);
				} else {
					console.log(`服务器 ${entity.ip} ${reason}，剩余重试次数 ${retryCount}`);
					setTimeout(() => {
						this.initializeServer(serverId, ip, port, username, password, retryCount - 1);
					}, 150);
				}
			});

			entity.on('ffmpegInfo', (data) => {
				handleFFmpegInfo(server, data);
			});
			entity.on('workingStatusUpdate', (data) => {
				if (data.workingStatus) handleStatusUpdate(server, data.workingStatus);
				server.data.progress = data.progress;
			});
			entity.on('tasklistUpdate', (data) => {
				handleTasklistUpdate(server, data);
			});
			entity.on('taskUpdate', (data) => {
				handleTaskUpdate(server, data.taskId, data.task);
			});
			entity.on('cmdUpdate', (data) => {
				handleCmdUpdate(server, data.taskId, data.runIndex, data.content, data.append);
			});
			entity.on('progressUpdate', (data) => {
				handleProgressUpdate(server, data.taskId, data.runIndex, data.time, data.status, this.functionLevel);
			});
			entity.on('notificationUpdate', (data) => {
				handleNotificationUpdate(server, data.notificationId, data.notification);
			});
			entity.on('asyncListUpdate', (data) => {
				server.data.asyncList = data.list;
			});
		});
	},
	/**
	 * 重新连接已掉线或未成功连接的服务器
	 */
	reConnectServer(serverId: string) {
		const server = this.servers.find((s) => s.data.id === serverId) as Server;
		const entity = server.entity;
		this.initializeServer(serverId, entity.ip!, entity.port!, entity.username!, entity.password!);
	},
	// #endregion 服务器处理

	// 移动端 functionLevel 沿用当前服务器的 functionLevel，功能未实现，以下注释保留位置
	// activateBackend(...) { ... },
	// activateFrontend(...) { ... },
	// applyFrontendSettings(...) { ... },
});

// #endregion
