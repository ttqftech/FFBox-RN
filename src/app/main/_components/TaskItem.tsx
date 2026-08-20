// 移植自 FFBox `TaskItem.tsx`，精简为移动端两行布局。
// 第一行：状态图标 + 任务 id + 任务名 + 进度百分比；第二行：输出大小 / 时间 / 速度 / 预计剩余时间。
// 背景进度条：绿/黄/灰/红（对齐 FFBox taskBackgroundProgressStyle）。
// 左滑露出「选择预设」「暂停/重置/删除」两个操作按钮。
// 多选模式：点任务 = 切换选中，不进入详情。
import { memo } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SvgProps } from 'react-native-svg';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/appStore';
import { TaskStatus } from '@/common/types';
import { UITask } from '@/types';
import { colors, shadows } from '@/common/theme';
import { formatSize, formatTime, formatSpeed, formatLeftTime } from '@/common/formatUtils';
import { getOutputDuration } from '@/common/utils';
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

// 进度条颜色（对齐 FFBox taskBackgroundProgressStyle 的绿/黄/灰/红）
function getProgressColor(status: TaskStatus): string {
	switch (status) {
		case TaskStatus.running:
		case TaskStatus.finishing:
			return colors.green;
		case TaskStatus.paused:
		case TaskStatus.paused_queued:
		case TaskStatus.stopping:
			return colors.yellow;
		case TaskStatus.finished:
		case TaskStatus.idle:
			return colors.gray;
		case TaskStatus.error:
			return colors.red;
		default:
			return colors.blue;
	}
}

export const TaskItem = memo(function TaskItem({ taskId, isSelected, onPress }: Props) {
	const snap = useSnapshot(appStore);
	const server = snap.currentServer;
	const index = server?.data.taskIdToIndex.get(taskId);
	const task = (index !== undefined ? server?.data.tasks[index] : undefined) as UITask | undefined;
	if (!task) return null;
	const run = task.runs[task.runs.length - 1];
	const d = run?.dashboard_smooth ?? { progress: 0, bitrate: 0, speed: 0, time: 0, frame: 0, size: 0 };
	const runStatus = run?.status ?? task.status;

	const StatusIcon = getStatusIcon(runStatus);
	const progressColor = getProgressColor(runStatus);
	const pct = Math.round((d.progress ?? 0) * 100);
	const dashboardVisible = [TaskStatus.running, TaskStatus.paused, TaskStatus.paused_queued, TaskStatus.stopping, TaskStatus.finishing].includes(runStatus);
	const totalDuration = getOutputDuration(task);

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
		// 预设选择在步骤 5 实现，此处占位
		Alert.alert('选择预设', '预设选择功能将在后续版本提供');
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
	const secondActionIcon: IoniconName = (() => {
		switch (task.status) {
			case TaskStatus.running:
			case TaskStatus.paused_queued: return 'pause';
			case TaskStatus.idle:
			case TaskStatus.initializing: return 'trash-outline';
			default: return 'refresh';
		}
	})();

	const renderRightActions = (_progress: unknown, _translation: unknown, methods: SwipeableMethods) => (
		<View style={styles.actions}>
			<TouchableOpacity
				style={[styles.actionBtn, styles.actionPreset]}
				onPress={() => { methods.close(); handleChoosePreset(); }}
			>
				{/* FFBox 无预设图标，保留 Ionicons */}
				<Ionicons name="albums-outline" size={20} color="#fff" />
				<Text style={styles.actionText}>预设</Text>
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.actionBtn, styles.actionPauseNremove]}
				onPress={() => { methods.close(); handlePauseNremove(); }}
			>
				{/* 暂停/删除/重置按钮：FFBox 同款 deleteNpause_button.svg */}
				<Ionicons name={secondActionIcon} size={20} color="#fff" />
				<Text style={styles.actionText}>暂停/删除</Text>
			</TouchableOpacity>
		</View>
	);

	return (
		<ReanimatedSwipeable renderRightActions={renderRightActions} friction={2} rightThreshold={40} overshootRight={false}>
			<Pressable style={[styles.task, isSelected && styles.selected]} onPress={handlePress}>
				<View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: progressColor }]} />
				<View style={styles.row1}>
					<StatusIcon width={20} height={20} style={styles.statusIcon} />
					<Text style={styles.id}>{task.id}</Text>
					<Text style={styles.name} numberOfLines={1}>
						{task.taskName ?? '读取中'}
					</Text>
					<Text style={styles.pct}>{((d.progress ?? 0) * 100).toFixed(1)}%</Text>
				</View>
				<View style={styles.row2}>
					<Text style={styles.metric}>{dashboardVisible ? formatSize(d.size) : '-'}</Text>
					<Text style={styles.metric}>{dashboardVisible ? formatTime(d.time, 'display') : '-'}</Text>
					<Text style={styles.metric}>{dashboardVisible ? formatSpeed(d.speed) : '-'}</Text>
					<Text style={styles.metric}>{dashboardVisible ? formatLeftTime(totalDuration, d.time, d.speed) : '-'}</Text>
				</View>
			</Pressable>
		</ReanimatedSwipeable>
	);
});

const styles = StyleSheet.create({
	task: {
		backgroundColor: colors.card,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 6,
		borderRadius: 3,	// 对齐 FFBox .backgroundWhite 的 border-radius: 3px
		overflow: 'hidden',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		...shadows.taskItem,
	},
	selected: {
		backgroundColor: colors.menuItemHovered,
		borderColor: colors.primary,
	},
	progressFill: {
		position: 'absolute',
		left: 0,
		bottom: 0,
		height: 3,
	},
	row1: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	statusIcon: { marginRight: 6 },
	id: { fontSize: 12, color: colors.textSub, marginRight: 6 },
	name: { flex: 1, fontSize: 15, color: colors.textMain },
	pct: { fontSize: 15, fontWeight: '600', color: colors.primary, marginLeft: 8 },
	row2: {
		flexDirection: 'row',
		marginTop: 8,
	},
	metric: { fontSize: 12, color: colors.textSub, marginRight: 14 },
	actions: {
		flexDirection: 'row',
	},
	actionBtn: {
		width: 76,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 2,
	},
	actionPreset: { backgroundColor: '#8a94a6' },
	actionPauseNremove: { backgroundColor: colors.red },
	actionText: { fontSize: 11, color: '#fff' },
});
