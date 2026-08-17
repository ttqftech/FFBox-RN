// 移植自 FFBox `src/renderer/src/logic/eventsHandler.tsx`。
// 改动点：
//   1. `useAppStore()`（Pinia）→ 直接引用 valtio 的 `appStore`。
//   2. 移除 Popup / Msgbox / nodeBridge 等桌面端依赖。
//   3. handleTasklistUpdate 简化：移动端不做无限滚动，新增任务直接全量重拉。
import { FFmpegInfo, FFmpegProgress, Notification, TaskForUpdate, TaskStatus, WorkingStatus } from '../common/types';
import { Server } from '../types';
import { mergeTaskFromService } from '../common/utils';
import { registerServerForDashboard } from '../common/dashboardCalc';
import { appStore } from '../stores/appStore';
import { getLimitation } from '../common/limitations';

// #region server events

export function handleFFmpegInfo(server: Server, info: FFmpegInfo) {
	server.data.ffmpegInfo = info;
};
export function handleStatusUpdate(server: Server, workingStatusCommit: 'start' | 'stop' | 'pause') {
	const serverData = server.data;
	serverData.workingStatus = workingStatusCommit === 'start' ? WorkingStatus.running : WorkingStatus.idle;
	// if (workingStatusCommit === 'stop') {
	// 	nodeBridge.flashFrame(true);
	// }
	// 根据队列状态启停全局 dashboardTimer
	registerServerForDashboard(server, workingStatusCommit === 'start' ? 'start' : 'stop');
};
export function handleTasklistUpdate(server: Server, data: { added?: { taskId: number; index: number }[]; removed?: { taskId: number }[]; totalCount: number }) {
	const serverData = server.data;

	// 更新总数
	serverData.totalCount = data.totalCount;

	// 处理删除
	if (data.removed?.length) {
		for (const { taskId } of data.removed) {
			appStore.selectedTask.delete(taskId);
			const arrayIndex = serverData.taskIdToIndex.get(taskId);
			if (arrayIndex !== undefined) {
				const removedGlobalIndex = serverData.tasks[arrayIndex].taskIndex;
				serverData.tasks.splice(arrayIndex, 1);
				serverData.taskIdToIndex.delete(taskId);
				// 修正被 splice 影响的后续元素的数组索引
				for (const [id, idx] of serverData.taskIdToIndex) {
					if (idx > arrayIndex) {
						serverData.taskIdToIndex.set(id, idx - 1);
					}
				}
				// 修正被删除任务之后的任务的全局序号
				for (const task of serverData.tasks) {
					if (task.taskIndex > removedGlobalIndex) {
						task.taskIndex--;
					}
				}
				serverData.bufferEnd--;
			}
		}
	}

	// 处理新增：移动端不做无限滚动，新增任务直接重新拉取全量任务
	if (data.added?.length) {
		appStore.updateTaskList().catch((e) => console.warn('[handleTasklistUpdate] updateTaskList 失败', e));
	}
};
/**
 * 更新整个 task
 * @param isComplete true 表示来自 getTask 等接口的完整 Task（包含 progressLog、cmdData），应完整替换
 *                   false（默认）表示来自 taskUpdate 事件的 TaskForUpdate（剥离了 progressLog、cmdData），仅部分替换
 */
export function handleTaskUpdate(server: Server, id: number, content: TaskForUpdate, isComplete: boolean = false) {
	const serverData = server.data;
	const arrayIndex = serverData.taskIdToIndex.get(id);
	if (arrayIndex === undefined) {
		// 本地缓冲区不存在此任务，忽略
		return;
	}
	const localTask = serverData.tasks[arrayIndex];
	const task = mergeTaskFromService(localTask, content, isComplete);
	serverData.tasks[arrayIndex] = task;
	// 找到当前正在运行的 run（从后往前找第一个 running 状态的）
	const activeRun = [...task.runs].reverse().find(r => r.status === TaskStatus.running);
	const latestRun = task.runs[task.runs.length - 1];
	const displayRun = activeRun || latestRun;
	// 进度条相关处理（smooth 初始化由全局 timer 的 updateTaskDashboard 负责）
	if (task.status === TaskStatus.finished || task.status === TaskStatus.error) {
		displayRun.dashboard.progress = 1;
		displayRun.dashboard_smooth.progress = 1;
	} else if (task.status === TaskStatus.idle) {
		displayRun.dashboard.progress = 0;
		displayRun.dashboard_smooth.progress = 0;
	}
};
/**
 * 增量更新 cmdData
 * 如果本地没有对应的 run，拉取完整任务
 */
export function handleCmdUpdate(server: Server, id: number, runIndex: number, content: string, append: boolean) {
	const arrayIndex = server.data.taskIdToIndex.get(id);
	if (arrayIndex === undefined) return;
	let task = server.data.tasks[arrayIndex];
	const run = task.runs[runIndex];
	if (!run) {
		// 例外情况：本地没有对应的 run，拉取完整任务
		console.warn(`[handleCmdUpdate] 任务 ${id} 的 run ${runIndex} 不存在，拉取完整任务`);
		server.entity.getTask(id).then((content) => {
			handleTaskUpdate(server, id, content, true);
		});
		return;
	}
	if (append) {
		run.cmdData += content;
	} else {
		run.cmdData = content;
	}
};
/**
 * 增量更新 progressLog
 * 如果本地没有对应的 run，拉取完整任务
 */
export function handleProgressUpdate(server: Server, id: number, runIndex: number, time: number, status: FFmpegProgress | undefined, functionLevel: number) {
	const arrayIndex = server.data.taskIdToIndex.get(id);
	if (arrayIndex === undefined) return;
	const task = server.data.tasks[arrayIndex];
	const run = task.runs[runIndex];
	if (!run) {
		// 例外情况：本地没有对应的 run，拉取完整任务
		console.warn(`[handleProgressUpdate] 任务 ${id} 的 run ${runIndex} 不存在，拉取完整任务`);
		server.entity.getTask(id).then((content) => {
			handleTaskUpdate(server, id, content, true);
		});
		return;
	}
	if (status) {
		for (const parameter of ['time', 'frame', 'size']) {
			const _parameter = parameter as 'time' | 'frame' | 'size';
			run.progressLog[_parameter].push([time, status[_parameter]]);
		}
	} else {
		run.lastStarted = time;
		run.elapsed = 0;
		run.lastPaused = time;
		run.progressLog = {
			time: [],
			frame: [],
			size: [],
		};
	}
	if (functionLevel < 50 && run.progressLog.time.length > 0) {
		if (run.progressLog.time.slice(-1)[0][1] > 671) {
			server.entity.trailLimit_stopTranscoding(id, 'media');
			return;
		}
	}
	const maxWorkingDuration = getLimitation('maxWorkingDuration', functionLevel);
	if (run.progressLog.time.length > 0) {
		if (run.elapsed + new Date().getTime() / 1000 - run.lastStarted > (maxWorkingDuration ?? Infinity)) {
			server.entity.trailLimit_stopTranscoding(id, 'working');
			return;
		}
	}
};
/**
 * 增量更新 notifications
 */
export function handleNotificationUpdate(server: Server, notificationId: number, notification?: Notification) {
	if (notification) {
		server.data.notifications[notificationId] = notification;
		// const serverNameString = store.servers.length > 1 ? `${server.data.name}：` : '';
		// Popup({
		// 	message: serverNameString + notification.content,
		// 	level: notification.level,
		// });
		appStore.setUnreadNotifationCount();
	} else {
		delete server.data.notifications[notificationId];
	}
};

// #endregion
