// 移植自 FFBox `src/common/utils.ts`，仅保留移动端所需的部分。
import { OutputParams, Run, Task, TaskForUpdate, TaskStatus } from './types';
import { UIRun, UITask } from '../types';
import { parseTime } from './formatUtils';

// #region 字符串转换区

/**
 * 获取随机字符串
 */
export function randomString(length = 6, dictionary = 'abcdefghijklmnopqrstuvwxyz'): string {
	let result = '';
	for (let i = length; i > 0; --i) result += dictionary[Math.floor(Math.random() * dictionary.length)];
	return result;
}

// #endregion

// #region 任务转换区

// 创建默认的 Run 快照
export function getNewRun(after?: OutputParams): Run {
	return {
		after: after || {
			input: {
				files: [],
			},
			filter: {
				nodes: [],
				lines: [],
			},
			outputs: [
				{
					video: {
						vcodec: '自动',
						detail: {}
					},
					audio: {
						acodec: '',
						detail: {}
					},
					mux: {
						format: '',
						moveflags: false,
						filePath: '',
						detail: {},
					},
				}
			],
			extra: {},
		},
		paraArray: [],
		outputFiles: [],
		status: TaskStatus.idle,
		lastStarted: new Date().getTime() / 1000,
		elapsed: 0,
		lastPaused: new Date().getTime() / 1000,
		progressLog: {
			time: [],
			frame: [],
			size: [],
		},
		cmdData: '',
		errorInfo: [],
	};
}

// 创建默认的 UIRun 快照（含前端 dashboard 数据）
export function getNewUIRun(after?: OutputParams): UIRun {
	return {
		...getNewRun(after),
		dashboard: {
			progress: 0,
			bitrate: 0,
			speed: 0,
			time: 0,
			frame: 0,
			size: 0,
		},
		dashboard_smooth: {
			progress: 0,
			bitrate: 0,
			speed: 0,
			time: 0,
			frame: 0,
			size: 0,
		},
	};
}

// 获取 Task 中当前正在运行的 Run（正在运行的条目，优先返回最新条目）
export function getCurrentRun(task: Task): Run {
	// 从后往前找第一个 status 为运行态的条目；若无则返回最新条目
	for (let i = task.runs.length - 1; i >= 0; i--) {
		const run = task.runs[i];
		if ([TaskStatus.running, TaskStatus.paused, TaskStatus.paused_queued, TaskStatus.stopping, TaskStatus.finishing].includes(run.status)) {
			return run;
		}
	}
	return task.runs[task.runs.length - 1];
}

/**
 * 根据 runIndex 获取 Task 的 OutputParams，不传则取最新
 */
export function getTaskOutputParams(task: Task, runIndex?: number): OutputParams {
	return task.runs[runIndex ?? task.runs.length - 1].after;
}

// 获取 Task 的当前 after（从最新 run 中读取）
export function getTaskLatestOutputParams(task: Task): OutputParams {
	return task.runs[task.runs.length - 1].after;
}

export function getInitialTask(id: number, fileName: string, outputParams?: OutputParams): Task {
	const mediaInfoRun = getNewRun();
	mediaInfoRun.cmdData = '(等待媒体信息扫描)';
	const firstRun = getNewRun();
	if (outputParams) {
		firstRun.after = outputParams;
	}
	return {
		id,
		taskName: fileName,
		before: [],
		status: TaskStatus.idle,
		runs: [mediaInfoRun, firstRun],
	};
}

export function getInitialUITask(id: number, fileName: string, outputParams?: OutputParams): UITask {
	const baseTask = getInitialTask(id, fileName, outputParams);
	// 将 Task 的 Run[] 转换为 UIRun[]（添加 dashboard 数据）
	const uiRuns: UIRun[] = baseTask.runs.map((run) => ({
		...run,
		dashboard: {
			progress: 0,
			bitrate: 0,
			speed: 0,
			time: 0,
			frame: 0,
			size: 0,
		},
		dashboard_smooth: {
			progress: 0,
			bitrate: 0,
			speed: 0,
			time: 0,
			frame: 0,
			size: 0,
		},
	}));
	return {
		...baseTask,
		runs: uiRuns,
		taskIndex: 0,
		selectedRunIndex: 1,
	};
}

/**
 * 计算输出时长
 * @param runIndex 索引值，不传则取最新
 */
export function getOutputDuration(task: Task, runIndex?: number): number {
	let duration = task.before[0]?.duration || NaN;
	if (isNaN(duration)) {
		return NaN;
	}
	const after = getTaskOutputParams(task, runIndex);
	const firstInput = after.input.files[0];
	const firstOutput = after.outputs[0].mux;
	if (!firstInput || !firstOutput) {
		return NaN;
	}
	if (firstInput.begin || firstInput.end) {
		const begin = firstInput.begin ? parseTime(firstInput.begin) : 0;
		let end = firstInput.end ? parseTime(firstInput.end) : duration;
		if (begin === -1 || end === -1 || begin > end || begin > duration) {
			return NaN;
		}
		end = Math.min(end, duration);
		duration = end - begin;
	}
	if (firstOutput.begin || firstOutput.end) {
		const begin = firstOutput.begin ? parseTime(firstOutput.begin) : 0;
		let end = firstOutput.end ? parseTime(firstOutput.end) : duration;
		if (begin === -1 || end === -1 || begin > end || begin > duration) {
			return NaN;
		}
		end = Math.min(end, duration);
		duration = end - begin;
	}
	return duration;
}

/**
 * 来自 FFBoxService 的任务信息自网络接收后与现存的 UITask 进行合并
 * @param isComplete true 表示来自 getTask 等接口的完整 Task（包含 progressLog、cmdData），应完整替换
 *                   false（默认）表示来自 taskUpdate 事件的 TaskForUpdate（剥离了 progressLog、cmdData），保留本地已有的值
 */
export function mergeTaskFromService(self: UITask, remote: TaskForUpdate | Task, isComplete: boolean = false): UITask {
	const ret = self;
	// 深拷贝 remote 中除 runs 以外的字段
	const remoteCopy = JSON.parse(JSON.stringify(remote));
	const remoteRuns = (remoteCopy.runs || []) as Run[];
	delete remoteCopy.runs;
	Object.assign(ret, remoteCopy);
	// 合并 runs：保留已有 UIRun 的 dashboard 数据，更新 Run 层的字段
	while (ret.runs.length < remoteRuns.length) {
		// 远端有更多 run 条目，补充 UIRun
		ret.runs.push({
			// @ts-ignore 非完整的 Task 不存在这两项，而出现新 run 代表这两项也是空的，所以直接写在这
			progressLog: {
				time: [],
				frame: [],
				size: [],
			},
			// @ts-ignore
			cmdData: '',
			...remoteRuns[ret.runs.length],
			dashboard: { progress: 0, bitrate: 0, speed: 0, time: 0, frame: 0, size: 0 },
			dashboard_smooth: { progress: 0, bitrate: 0, speed: 0, time: 0, frame: 0, size: 0 },
		});
	}
	for (let i = 0; i < remoteRuns.length; i++) {
		const remoteRun = remoteRuns[i];
		const localRun = ret.runs[i];
		// 更新 Run 层字段
		localRun.after = remoteRun.after;
		localRun.paraArray = remoteRun.paraArray;
		localRun.outputFiles = remoteRun.outputFiles;
		localRun.status = remoteRun.status;
		localRun.lastStarted = remoteRun.lastStarted;
		localRun.elapsed = remoteRun.elapsed;
		localRun.lastPaused = remoteRun.lastPaused;
		localRun.errorInfo = remoteRun.errorInfo;
		// progressLog 和 cmdData 的处理：完整 Task 时覆盖，部分 Task 时保留本地值
		if (isComplete) {
			// 当 isComplete 为 true 时，remote 实际上是 Task 类型，remoteRun 是 Run 类型
			localRun.progressLog = remoteRun.progressLog;
			localRun.cmdData = remoteRun.cmdData;
		}
		// else: 保留本地已有的 progressLog 和 cmdData（由增量事件更新）
	}
	return ret;
}

/**
 * 在不影响原有任务特有参数（如文件列表）的情况下替换 OutputParams
 * @param from 新的参数列表
 * @param to 任务原有的参数列表
 * @param fullyReplace true 为全量替换；false 为部分替换（保留 to 中输入文件路径）
 */
export function replaceOutputParams(from: OutputParams, to: OutputParams, fullyReplace: boolean): OutputParams {
	if (fullyReplace) {
		// 全量替换，直接用 from 深拷贝
		return JSON.parse(JSON.stringify(from));
	}

	// 部分替换：保留 to 的整体结构，仅替换部分内容
	const ret: OutputParams = JSON.parse(JSON.stringify(to));

	// input.files 部分字段替换：仅替换 begin, end, hwaccel, readrate, custom，不改 filePath
	for (let i = 0; i < Math.min(to.input.files.length, from.input.files.length); i++) {
		const fromFile = from.input.files[i];
		const toFile = ret.input.files[i];
		toFile.begin = fromFile.begin;
		toFile.end = fromFile.end;
		toFile.hwaccel = fromFile.hwaccel;
		toFile.readrate = fromFile.readrate;
		toFile.custom = fromFile.custom;
	}

	// outputs 整个替换
	ret.outputs = JSON.parse(JSON.stringify(from.outputs));

	// filter 替换，并处理 nodes/lines 清理逻辑
	ret.filter = JSON.parse(JSON.stringify(from.filter));
	// 将超出 to 文件数量的输入节点去掉
	const inputNodeCount = ret.input.files.length;
	for (let i = ret.filter.nodes.length - 1; i >= 0; i--) {
		const node = ret.filter.nodes[i];
		const match = node.name?.match(/^in_(\d+)$/);
		if (!match) {
			continue;	// 保留非输入节点
		}
		if (+match[1] >= inputNodeCount) {
			// 删除这个输入节点
			deleteNode(ret.filter.nodes, ret.filter.lines, node);
		}
	}

	// extra 部分完整覆盖
	ret.extra = JSON.parse(JSON.stringify(from.extra));

	return ret;
}

/** 从 nodes 中删除节点，并清理与之相连的 lines */
function deleteNode(nodes: { id: number; name: string }[], lines: { prevNodeId: number; nextNodeId: number }[], node: { id: number }) {
	const index = nodes.findIndex((n) => n.id === node.id);
	if (index === -1) return;
	nodes.splice(index, 1);
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].prevNodeId === node.id || lines[i].nextNodeId === node.id) {
			lines.splice(i, 1);
		}
	}
}

// #endregion

// #region 实用功能

/**
 * 拷贝自 https://www.npmjs.com/package/typed-emitter
 */
export type Arguments<T> = [T] extends [(...args: infer U) => any]
	? U
	: [T] extends [void] ? [] : [T];

export interface TypedEventEmitter<Events> {
	addListener<E extends keyof Events>(event: E, listener: Events[E]): this
	on<E extends keyof Events>(event: E, listener: Events[E]): this
	once<E extends keyof Events>(event: E, listener: Events[E]): this
	prependListener<E extends keyof Events>(event: E, listener: Events[E]): this
	prependOnceListener<E extends keyof Events>(event: E, listener: Events[E]): this

	off<E extends keyof Events>(event: E, listener: Events[E]): this
	removeAllListeners<E extends keyof Events>(event?: E): this
	removeListener<E extends keyof Events>(event: E, listener: Events[E]): this

	emit<E extends keyof Events>(event: E, ...args: Arguments<Events[E]>): boolean
	eventNames(): (keyof Events | string | symbol)[]
	// eslint-disable-next-line @typescript-eslint/ban-types
	rawListeners<E extends keyof Events>(event: E): Function[];
	// eslint-disable-next-line @typescript-eslint/ban-types
	listeners<E extends keyof Events>(event: E): Function[];
	listenerCount<E extends keyof Events>(event: E): number;

	getMaxListeners(): number;
	setMaxListeners(maxListeners: number): this;
}

// #endregion
