// 移植自 FFBox `src/common/types.ts`，仅保留移动端所需的核心类型。
// 与 FFBox 保持一致：全库中文注释、#region 分块。

// #region 软件功能及版本等信息

export enum NotificationLevel {
	info = 0,
	ok = 1,
	warning = 2,
	error = 3,
}

export interface Notification {
	time: number;
	taskId?: number;
	content: string;
	level: NotificationLevel;
}

export interface FFmpegInfo {
	version: string;
	scanning: boolean;
	videoEncodersCount: number;
	audioEncodersCount: number;
	muxersCount: number;
	demuxersCount: number;
	filtersCount: number;
}

// #endregion

// #region FFBoxService

export interface FFBoxServiceEventParam {
	ffmpegInfo: FFmpegInfo;
	workingStatusUpdate: { workingStatus?: 'start' | 'stop' | 'pause'; progress: number };	// 合并原 workingStatusUpdate 与总进度推送。workingStatus 在队列状态变化时携带，progress 始终携带
	tasklistUpdate: { added?: { taskId: number; index: number }[]; removed?: { taskId: number }[]; totalCount: number };
	taskUpdate: { taskId: number; task: TaskForUpdate };
	cmdUpdate: { taskId: number; runIndex: number; content: string; append: boolean };	// 由 append 确定是增量还是全量更新
	progressUpdate: { taskId: number; runIndex: number; time: number; status?: FFmpegProgress };	// 增量更新（status 未定义则为清空）
	notificationUpdate: { notificationId: number; notification?: Notification };	// 增量（notification 未定义则为删除）
	asyncListUpdate: { list: { type: string }[] };
}

export type FFBoxServiceEvent = {
	[K in keyof FFBoxServiceEventParam]: (arg: FFBoxServiceEventParam[K]) => void;
};

// FFBoxService emit 到前端
export type FFBoxServiceEventApi = {
	event: keyof FFBoxServiceEventParam;
	payload: FFBoxServiceEventParam[keyof FFBoxServiceEventParam];
} | {
	event: 'connected';
	payload: { timestamp: number };
} | {
	event: 'asyncListLength';
	payload: number;
};

// 客户端调用服务端消息
export type WsClientMessage = {
	type: 'subscribe';
	taskIds: number[];
} | {
	type: 'unsubscribe';
	taskIds: number[];
} | {
	type: 'replaceSubscription';
	taskIds: number[];
};

// 任务列表响应（带总数）
export interface TaskListResponse {
	tasks: Task[];
	totalCount: number;
}

// #endregion

// #region 编码器及滤镜

export interface EncoderDetail {
	options: {
		name: string;
		type: 'int' | 'int64' | 'float' | 'double' | 'boolean' | 'string' | 'dictionary' | 'flags' | 'color' | 'duration' | 'image_size' | 'rational' | 'sample_fmt[]' | 'int[]' | 'channel_layout[]';
		description: string;
		options?: { name?: string, value: string | number, description?: string }[];
	}[];
}

// 由 service 向前端报告的编码器详情
export interface FFmpegCodecDetail {
	name: string;
	description: string;
	encoders: (EncoderDetail & { name: string; })[];
}

// 由 service 向前端报告的复用器详情
export interface FFmpegDemuxerDetail {
	name: string;
	description: string;
	extensions: string[];
	isDevice: boolean;
	options: EncoderDetail['options'];
};
export interface FFmpegMuxerDetail {
	name: string;
	description: string;
	extensions: string[];
	defaultVideoCodec?: string;
	defaultAudioCodec?: string;
	options: EncoderDetail['options'];
};

// 由 service 向前端报告的滤镜详情
export interface FFmpegFilterDetail {
	name: string;
	description: string;
	inputType: string;
	outputType: string;
	options: EncoderDetail['options'];
}

// #endregion

// #region 输入参数

export interface Frame {
	n: number;			// 帧号
	pts?: number;		// 时间戳
	pts_time: number;	// 换算为秒的时间戳
	type: 'I' | 'P' | 'B';	// 帧类型
}

export interface StreamInfo {
	infoText?: string;	// 原文
	type: string;	// video, audio, subtitle, data, attachment
	metadata: { [key: string]: string };
	sidedata: string[];
	isDefault?: boolean;
	language?: string;
	codec?: string;
	pixelFormat?: string;
	resolution?: string;
	bitrate?: number;
	fps?: number;
	sampleRate?: number;
	channel?: string;
}
export interface ChapterInfo {
	infoText?: string;	// 原文
	start: number;
	end: number;
	metadata: { [key: string]: string };
}
export interface InputInfo {
	demuxer: string;
	path: string;
	duration?: number;
	bitrate?: number;
	start?: number;
	metadata: { [key: string]: string };
	streams: StreamInfo[];
	chapters: ChapterInfo[];
	accessTime?: number,
	createTime?: number,
	modifyTime?: number,
}

// #endregion

// #region 输出参数、预设

export interface InputFile {
	// type: 'url';	// 将来支持 lavfi
	skipFrame?: string;
	hwaccel?: string;
	filePath?: string;		// 本地模式下直接是文件全路径，网络模式下 merge 之后获得的文件名填充到此处
	demuxer?: string;
	begin?: string;
	end?: string;
	readrate?: string;
	detail?: Record<string, any>;
	custom?: string;
}

export interface FilterNode {
	id: number;
	name: string;	// 如果是滤镜节点，这里是滤镜本体名字；如果是输入节点，这里是 in_\d；如果是输出节点，这里是 out_\d
	params: Record<string, any>;
	x: number;
	y: number;
}

export interface FilterLine {
	name: string;	// 相当于 ffmpeg 中括号内的内容
	prevNodeId: number;
	prevNodePortIndex: number;
	nextNodeId: number;
	nextNodePortIndex: number;
}

export interface OutputParams {
	input: OutputParams_input;
	filter: OutputParams_filter;
	outputs: {
		video: OutputParams_video;
		audio: OutputParams_audio;
		mux: OutputParams_mux;
	}[];
	extra: OutputParams_extra;
}

export type OutputParams_input = {
	files: InputFile[];
};

export type OutputParams_filter = {
	nodes: FilterNode[];
	lines: FilterLine[];
};

export type OutputParams_video = {
	vcodec: string;
	resolution?: string;
	framerate?: string;
	ratecontrol?: string;
	detail: Record<string, any>;
	custom?: string;
}

export type OutputParams_audio = {
	acodec: string;
	ratecontrol?: string;
	detail: Record<string, any>;
	custom?: string;
};

export type OutputParams_mux = {
	format: string;
	moveflags: boolean;
	filePath: string;
	begin?: string;
	end?: string;
	detail: Record<string, any>;
	keepMetadata?: false | 'map' | 'movflags' | 'both';
	keepFileTime?: false | 'original' | 'autoShift' | 'fixCTbyMTandShift' | 'fixByFilenameAndShift';
	custom?: string;
};

export type OutputParams_extra = {
	presetName?: string;
}

// #endregion

// #region 任务

export enum TaskStatus {
	deleted = 'deleted',
	initializing = 'initializing',
	idle = 'idle',
	idle_queued = 'idle_queued',
	running = 'running',
	paused = 'paused',
	paused_queued = 'paused_queued',
	stopping = 'stopping',
	finishing = 'finishing',
	finished = 'finished',
	error = 'error',
}

export interface FFmpegProgress {
	frame: number;
	fps: number;
	q: number;
	size: number;		// B
	time: number;		// 秒
	bitrate: number;	// bps
	speed: number;
}

export type SingleProgressLog = Array<[number, number]>;

// 单次运行快照
export interface Run {
	after: OutputParams;
	paraArray: Array<string>;
	outputFiles: string[];		// 对于远程任务，则为自动生成的文件名
	status: TaskStatus;
	// 运行时间相关字段（放在顶层以便 taskUpdate 传输）
	lastStarted: number;		// 最近一次开始运行的时间戳（秒）
	elapsed: number;			// 累计运行时间（秒），暂停时才更新
	lastPaused: number;			// 最近一次暂停的时间戳（秒）
	progressLog: {
		time: SingleProgressLog;	// 单位为 s
		frame: SingleProgressLog;
		size: SingleProgressLog;	// 单位为 B
	};
	cmdData: string;
	errorInfo: Array<string>;
}

// taskUpdate 中传输的 Run 快照（剥离 progressLog 和 cmdData 以减少数据量）
export type RunForUpdate = Omit<Run, 'progressLog' | 'cmdData'>;

// taskUpdate 中传输的 Task（runs 使用 RunForUpdate 类型）
export type TaskForUpdate = Omit<Task, 'runs'> & { runs: RunForUpdate[] };

export interface Task {
	id: number;		// 全局唯一任务 ID
	taskName: string;
	before: InputInfo[];
	status: TaskStatus;
	runs: Run[];	// 运行快照数组。0 号位置为 getFileMetadata 结果，其他运行记录从 1 号位置开始存储
}

export enum WorkingStatus {
	idle = 'idle',
	running = 'running',
}

// #endregion

// #region 权限、用户、转码设置

export enum Permission {
	UserManagement = 'userManagement',
	ServerSettings = 'serverSettings',
	CacheManagement = 'cacheManagement',
	FileSystem = 'fileSystem',
}

export interface UserConfig {
	username: string;           // 空字符串 = 管理员账号
	passkey: string;            // SHA256 哈希后的密码
	permissions: Permission[];   // 权限列表。空数组 = 已配置但无权限
}

export interface ServerSettingsData {
	maxThreads: number;
	customFFmpegPath: string;
	preserveUnfinishedTasks: boolean;
	deleteFinishedTasks: boolean;
}

// #endregion
