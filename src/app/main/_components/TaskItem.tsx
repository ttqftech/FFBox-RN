// 移植自 FFBox `TaskItem.tsx`，精简为移动端两行布局。
// 第一行：状态图标 + 任务 id + 任务名 + 进度百分比；第二行：输出大小 / 时间 / 速度 / 预计剩余时间。
// 背景进度条：绿/黄/灰/红（对齐 FFBox taskBackgroundProgressStyle）。
// 左滑露出「选择预设」「暂停/重置/删除」两个操作按钮。
// 多选模式：点任务 = 切换选中，不进入详情。
import { memo, useMemo } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { SvgProps } from 'react-native-svg';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/appStore';
import { TaskStatus } from '@/common/types';
import { UITask } from '@/types';
import { colors } from '@/common/theme';
import { formatSize, formatTime } from '@/common/formatUtils';
import { getOutputDuration } from '@/common/utils';
import { TaskProgressBar } from './TaskProgressBar';
// 任务状态图标：直接使用 FFBox 同款 SVG（见 FFBox TaskItem 目录），RN 引入后以组件形式使用
import IconInitializing from '@/assets/icons/taskStatus/initializing.svg';
import IconIdle from '@/assets/icons/taskStatus/idle.svg';
import IconIdleQueued from '@/assets/icons/taskStatus/idle_queued.svg';
import IconRunning from '@/assets/icons/taskStatus/running.svg';
import IconPaused from '@/assets/icons/taskStatus/paused.svg';
import IconPausedQueued from '@/assets/icons/taskStatus/paused_queued.svg';
import IconStopping from '@/assets/icons/taskStatus/stopping.svg';
import IconFinished from '@/assets/icons/taskStatus/finished.svg';
import IconError from '@/assets/icons/taskStatus/error.svg';
// 左滑操作按钮图标：第二个按钮使用 FFBox TaskItem/deleteNpause_button.svg（暂停/删除按钮同款）
import IconDeleteNpause from '@/assets/icons/deleteNpause_button.svg';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Props {
	taskId: number;
	isSelected: boolean;	// 如果在 TaskItem 内部检查，那么每次更新都触发所有 TaskItem render；通过 props 外部检查，就能利用 props 不变 memo 优化
	onPress?: (taskId: number) => void;	// 非选择模式点击任务（进入详情页，步骤 6 实现）
}

// 任务状态 → SVG 图标（对齐 FFBox taskStatusIcon 映射）
function getStatusIcon(status: TaskStatus): React.FC<SvgProps> {
	return [IconInitializing, IconIdle, IconIdleQueued, IconRunning, IconPaused, IconPausedQueued, IconStopping, IconFinished, IconError][
		[TaskStatus.initializing, TaskStatus.idle, TaskStatus.idle_queued, TaskStatus.running, TaskStatus.paused, TaskStatus.paused_queued, TaskStatus.stopping, TaskStatus.finished, TaskStatus.error].indexOf(status)
	];
}

export const TaskItem = memo(function TaskItem({ taskId, isSelected, onPress }: Props) {
	const router = useRouter();
	const snap = useSnapshot(appStore);
	const server = snap.currentServer;
	const index = server?.data.taskIdToIndex.get(taskId);
	const task = (index !== undefined ? server?.data.tasks[index] : undefined) as UITask | undefined;
	if (!task) return null;
	const run = task.runs[task.runs.length - 1];
	const dashboardData = run?.dashboard_smooth ?? { progress: 0, bitrate: 0, speed: 0, time: 0, frame: 0, size: 0 };
	const runStatus = run?.status ?? task.status;

	const StatusIcon = getStatusIcon(runStatus);
	const dashboardVisible = [TaskStatus.running, TaskStatus.paused, TaskStatus.paused_queued, TaskStatus.stopping, TaskStatus.finishing].includes(runStatus);
	const outputDuration = getOutputDuration(task);

	// 上传进度（对齐 FFBox TaskItem 的 uploadFiles/uploadStatus/transferInfo 计算）
	// 任务处于 initializing 且存在该任务的上传文件时，用蓝色进度条显示上传进度，否则显示转码进度
	const uploadFiles = (server?.data.uploadFiles ?? []).filter((uploadFile) => uploadFile.taskId === taskId);
	const uploadStatus = uploadFiles.length > 0 && task.status === TaskStatus.initializing
		? (uploadFiles.every((file) => file.status !== 'error') ? 'uploading' : 'error')
		: 'fine';
	const uploading = uploadStatus === 'uploading';
	// console.log('uploadStatus', uploadStatus, task.status);
	// 读取 / 校验 / 上传三个总量的累加
	const transferInfo = useMemo(() => {
		const totalSize = uploadFiles.reduce((prev, curr) => prev + (curr.size || Number.MAX_SAFE_INTEGER / 1024), 0);
		const totalRead = uploadFiles.reduce((prev, curr) => prev + curr.chunks.reduce((p, c) => p + c.size, 0), 0);
		const totalHash = uploadFiles.reduce((prev, curr) => prev + curr.chunks.reduce((p, c) => p + (c.hash ? c.size : 0), 0), 0);
		const totalUpload = uploadFiles.reduce((prev, curr) => prev + curr.chunks.reduce((p, c) => p + (c.transferred ?? 0), 0), 0);
		return { totalSize, totalRead, totalHash, totalUpload };
	}, [uploadFiles]);
	// 上传总进度（对齐 FFBox overallProgress 的 transfer 公式：读取/校验/上传 0.1/0.1/0.8）
	const uploadProgress = transferInfo.totalSize ? (transferInfo.totalRead * 0.1 + transferInfo.totalHash * 0.1 + transferInfo.totalUpload * 0.8) / transferInfo.totalSize : 0;
	// 最终进度条进度：上传时用上传进度，否则用转码进度
	const progress = uploading ? uploadProgress : (dashboardData.progress ?? 0);

	const formatSpeed = (value: number) => value >= 100 ? value.toFixed(0) + '×' : (value >= 10 ? value.toFixed(1) + '×' : value.toFixed(2) + '×');
	const formatLeftTime = (totalDuration: number, dashboardTime: number, dashboardSpeed: number) => {
	   if (dashboardSpeed > 0) {
		   const needTime = totalDuration / dashboardSpeed;
		   const remainTime = (totalDuration - dashboardTime) / totalDuration * needTime;	// 剩余进度比例 * 全进度耗时
		   return formatTime(remainTime, 'compact');
	   }
	   return '-';
   }
   
	const handlePress = () => {
		if (snap.selectedTask) {
			const newSelected = new Set(snap.selectedTask);
			if (newSelected.has(taskId)) newSelected.delete(taskId);
			else newSelected.add(taskId);
			appStore.selectedTask = newSelected.size === 0 ? undefined : newSelected;	// 如果清空了那就退出多选模式
		} else {
			onPress?.(taskId);
		}
	};

	const handleChoosePreset = () => {
		// 将当前任务设为选中，进入「选择预设」页（未运行改当前 run，运行后建新 run 由 applyPresetToTasks 处理）
		appStore.selectedTask = new Set([taskId]);
		router.push('/preset');
	};

	const handlePauseNremove = () => {
		// 参考 FFBox TaskItem.handlePauseNremove
		const server = appStore.currentServer;
		if (!server) return;
		const entity = server.entity;
		if (task.status === TaskStatus.running || task.status === TaskStatus.paused_queued) {
			entity.taskPause([taskId]);
		} else if ([TaskStatus.idle_queued, TaskStatus.paused, TaskStatus.stopping, TaskStatus.finishing, TaskStatus.finished, TaskStatus.error].includes(task.status)) {
			entity.taskReset([taskId]);
		} else if (task.status === TaskStatus.idle || task.status === TaskStatus.initializing) {
			appStore.deleteTasks([taskId]);
		}
	};

	// 左滑露出的第二个按钮图标按任务状态变化（暂停/重置/删除）
	const secondActionIcon: [IoniconName, string] = (() => {
		switch (task.status) {
			case TaskStatus.running:
			case TaskStatus.paused_queued: return ['pause', '暂停'];
			case TaskStatus.idle:
			case TaskStatus.initializing: return ['trash-outline', '删除'];
			default: return ['stop', '重置'];
		}
	})();

	const renderRightActions = (_progress: unknown, _translation: unknown, methods: SwipeableMethods) => (
		<View style={styles.actions}>
			<TouchableOpacity
				style={[styles.actionBtn, styles.actionPreset]}
				onPress={() => { methods.close(); handleChoosePreset(); }}
			>
				<Ionicons name="albums-outline" size={20} color={colors['66']} />
				<Text style={styles.actionText}>预设</Text>
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.actionBtn, styles.actionPauseNremove]}
				onPress={() => { methods.close(); handlePauseNremove(); }}
			>
				{/* 暂停/删除/重置按钮：FFBox 同款 deleteNpause_button.svg */}
				<Ionicons name={secondActionIcon[0]} size={20} color={colors['66']} />
				<Text style={styles.actionText}>{secondActionIcon[1]}</Text>
			</TouchableOpacity>
		</View>
	);

	return (
		<ReanimatedSwipeable renderRightActions={renderRightActions} friction={1} rightThreshold={40} overshootRight={false} containerStyle={{ overflow: 'visible' }}>
			<Pressable style={styles.taskWrapper} onPress={handlePress}>
				<View style={[styles.task, isSelected && styles.taskSelected]}>
					<TaskProgressBar status={runStatus} progress={progress} />
					<View style={styles.row1}>
						<StatusIcon width={20} height={20} style={styles.statusIcon} />
						<View style={styles.idOrIndex}>
							<Text style={styles.idOrIndexText}>{task.id}</Text>
						</View>
						<Text style={styles.name} numberOfLines={1}>
							{task.taskName ?? '读取中'}
						</Text>
						{(uploading || [TaskStatus.running, TaskStatus.paused, TaskStatus.paused_queued, TaskStatus.stopping, TaskStatus.finishing].includes(run.status)) && (
							<Text style={styles.pct}>{progress === 1 ? '🆗' : (progress * 100).toFixed(1)}%</Text>
						)}
					</View>
					<View style={styles.row2}>
						{uploading ? (
							// 上传中：在 dashboardVisible 位置替换显示读取/校验/上传三个总量（对齐 FFBox transfer dashboard）
							<View style={styles.row2LeftRight}>
								<Text style={styles.metric}>{'读取 ' + formatSize(transferInfo.totalRead)}</Text>
								<Text style={styles.metric}>{'校验 ' + formatSize(transferInfo.totalHash)}</Text>
								<Text style={styles.metric}>{'上传 ' + formatSize(transferInfo.totalUpload)}</Text>
							</View>
						) : dashboardVisible ? (
							<View style={styles.row2LeftRight}>
								<Text style={styles.metric}>{dashboardVisible ? '输出 ' + formatSize(dashboardData.size) : ''}</Text>
								<Text style={styles.metric}>{dashboardVisible ? `进度 ${formatTime(dashboardData.time, 'display')} / ${formatTime(outputDuration, 'compact')}` : ''}</Text>
								<Text style={styles.metric}>{dashboardVisible ? '速度 ' + formatSpeed(dashboardData.speed) : ''}</Text>
							</View>
						) : (
							<View style={styles.row2LeftRight}>
								<Text style={styles.metric}>{'输出时长 ' + formatTime(outputDuration, 'compact')}</Text>
							</View>
						)}
						{!uploading && (
							<Text style={[styles.metric, styles.metricLast]}>
								{dashboardVisible
									? '剩余 ' + formatLeftTime(outputDuration, dashboardData.time, dashboardData.speed)
									: ['准备中', '就绪', '排队开始', '暂停', '排队继续', '正在停止', '已完成', '出错'][[
										TaskStatus.initializing, TaskStatus.idle, TaskStatus.idle_queued, TaskStatus.paused, TaskStatus.paused_queued, TaskStatus.stopping, TaskStatus.finished, TaskStatus.error
									].indexOf(run.status)]
								}
							</Text>
						)}
					</View>
				</View>
			</Pressable>
		</ReanimatedSwipeable>
	);
});

const styles = StyleSheet.create({
	taskWrapper: {
		paddingHorizontal: 12,
		paddingTop: 0, paddingBottom: 12,	// 阴影扩展必要区域
		// outlineColor: 'red', outlineWidth: 1,
		marginTop: -8,
		overflow: 'visible',
	},
	task: {
		backgroundColor: colors['bg98'],
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 3,	// 对齐 FFBox .backgroundWhite 的 border-radius: 3px
		overflow: 'hidden',
		outlineColor: 'transparent', outlineWidth: 1,
		boxShadow: `0 0 1px 2px ${colors['bg98']}, 0 2px 6px 0 rgba(0, 0, 0, 0.2)`,
		// elevation: 4, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },	
	},
	taskSelected: {
		backgroundColor: colors.menuItemHovered,
		outlineColor: colors.menuItemSelected, outlineWidth: 1,
	},
	row1: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	statusIcon: { marginRight: 6 },
	idOrIndex: {
		fontSize: 12,
		color: colors.textSub,
		backgroundColor: colors['bg98'],
		marginRight: 6,
		borderWidth: 1.5, borderColor: '#7773',
		paddingVertical: 3, paddingHorizontal: 6,
		borderRadius: 12,
	},
	idOrIndexText: { fontSize: 9.6 },
	name: { flex: 1, fontSize: 16, color: colors['33'] },
	pct: { fontSize: 15, fontWeight: '600', color: colors.primary, marginLeft: 8 },
	row2: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 8,
	},
	row2LeftRight: {
		flexDirection: 'row',
	},
	metric: {
		fontSize: 11,
		color: colors['66'],
		marginRight: 12,
	},
	metricLast: { marginRight: 0 },
	actions: {
		flexDirection: 'row',
		marginBottom: 20,
		// outlineColor: 'red', outlineWidth: 1,
	},
	actionBtn: {
		width: 60,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 4,
		// outlineColor: 'red', outlineWidth: 1,
	},
	actionPreset: {
		// backgroundColor: colors['bg90']
	},
	actionPauseNremove: {
		// backgroundColor: colors['bg90']
	},
	actionText: {
		fontSize: 11,
		color: colors['66']
	},
});
