// 移植自 FFBox `TaskItem.tsx`，精简为移动端两行布局。
// 第一行：状态图标 + 任务 id + 任务名 + 进度百分比；第二行：输出大小 / 时间 / 速度 / 预计剩余时间。
// 背景进度条：绿/黄/灰/红（对齐 FFBox taskBackgroundProgressStyle）。
// 左滑露出「选择预设」「暂停/重置/删除」两个操作按钮。
// 多选模式：点任务 = 切换选中，不进入详情。
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSnapshot } from 'valtio';
import { appStore } from '../stores/appStore';
import { TaskStatus } from '../common/types';
import { UITask } from '../types';
import { colors } from '../common/theme';
import { formatSize, formatTime, formatSpeed, formatLeftTime } from '../common/formatUtils';
import { getOutputDuration } from '../common/utils';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Props {
	task: UITask;
	/** 非选择模式点击任务（进入详情页，步骤 6 实现） */
	onPress?: (task: UITask) => void;
}

// 任务状态 → 图标/颜色（参考 FFBox taskStatusIcon）
function getStatusVisual(status: TaskStatus): { icon: IoniconName; color: string } {
	switch (status) {
		case TaskStatus.initializing: return { icon: 'sync-outline', color: colors.blue };
		case TaskStatus.idle: return { icon: 'play-circle-outline', color: colors.textSub };
		case TaskStatus.idle_queued: return { icon: 'time-outline', color: colors.yellow };
		case TaskStatus.running: return { icon: 'play-circle', color: colors.green };
		case TaskStatus.paused: return { icon: 'pause-circle', color: colors.yellow };
		case TaskStatus.paused_queued: return { icon: 'hourglass-outline', color: colors.yellow };
		case TaskStatus.stopping: return { icon: 'stop-circle-outline', color: colors.yellow };
		case TaskStatus.finishing: return { icon: 'checkmark-circle-outline', color: colors.green };
		case TaskStatus.finished: return { icon: 'checkmark-circle', color: colors.gray };
		case TaskStatus.error: return { icon: 'close-circle', color: colors.red };
		default: return { icon: 'help-circle-outline', color: colors.textSub };
	}
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

// 是否显示 dashboard 实时数据（对齐 FFBox showDashboard）
function isDashboardVisible(status: TaskStatus): boolean {
	return [TaskStatus.running, TaskStatus.paused, TaskStatus.paused_queued, TaskStatus.stopping, TaskStatus.finishing].includes(status);
}

export function TaskItem({ task, onPress }: Props) {
	const snap = useSnapshot(appStore);
	const run = task.runs[task.selectedRunIndex];
	const d = run?.dashboard_smooth ?? { progress: 0, bitrate: 0, speed: 0, time: 0, frame: 0, size: 0 };
	const runStatus = run?.status ?? task.status;
	const { icon, color } = getStatusVisual(runStatus);
	const progressColor = getProgressColor(runStatus);
	const pct = Math.round((d.progress ?? 0) * 100);
	const dashboardVisible = isDashboardVisible(runStatus);
	const totalDuration = getOutputDuration(task);
	const selected = snap.multiSelect && snap.selectedTask.has(task.id);

	const handlePress = () => {
		if (snap.multiSelect) {
			// 选择模式：点任务 = 切换选中，不进入详情
			const selected = new Set(snap.selectedTask);
			if (selected.has(task.id)) selected.delete(task.id);
			else selected.add(task.id);
			appStore.selectedTask = selected;
		} else {
			onPress?.(task);
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
			entity.taskPause([task.id]);
		} else if ([TaskStatus.idle_queued, TaskStatus.paused, TaskStatus.stopping, TaskStatus.finishing, TaskStatus.finished, TaskStatus.error].includes(task.status)) {
			entity.taskReset([task.id]);
		} else if (task.status === TaskStatus.idle || task.status === TaskStatus.initializing) {
			appStore.deleteTasks([task.id]);
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
				<Ionicons name="albums-outline" size={20} color="#fff" />
				<Text style={styles.actionText}>预设</Text>
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.actionBtn, styles.actionPauseNremove]}
				onPress={() => { methods.close(); handlePauseNremove(); }}
			>
				<Ionicons name={secondActionIcon} size={20} color="#fff" />
				<Text style={styles.actionText}>暂停/删除</Text>
			</TouchableOpacity>
		</View>
	);

	return (
		<ReanimatedSwipeable renderRightActions={renderRightActions} friction={2} rightThreshold={40} overshootRight={false}>
			<Pressable style={[styles.task, selected && styles.selected]} onPress={handlePress}>
				<View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: progressColor }]} />
				<View style={styles.row1}>
					<Ionicons name={icon} size={20} color={color} style={styles.statusIcon} />
					<Text style={styles.id}>{task.id}</Text>
					<Text style={styles.name} numberOfLines={1}>
						{task.taskName ?? '读取中'}
					</Text>
					<Text style={styles.pct}>{pct}%</Text>
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
}

const styles = StyleSheet.create({
	task: {
		backgroundColor: colors.card,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 6,
		borderRadius: 8,
		overflow: 'hidden',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	selected: {
		backgroundColor: '#e8f2fd',
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
