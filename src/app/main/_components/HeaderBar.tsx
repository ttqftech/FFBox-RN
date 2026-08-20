// 移植自 FFBox `StatusBar.vue` + `ActionBar.vue` + `TitleBar.vue`（标题栏）。
// 移动端标题栏：左上 IP + 统计信息，中间 FFBox + 队列总进度（形如 PC 端 `FFBox - 100%`），右上 开始/暂停、多选、更多。
// 改动点（相对步骤 2）：原本位于画面底部的「队列总进度 footer」移除，进度改在标题栏中间的 FFBox 处展示。
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/appStore';
import { ServiceBridgeStatus } from '@/bridges/serviceBridge';
import { colors, shadows } from '@/common/theme';

interface Props {
	/** 点击「⋯」更多按钮（由主界面打开操作菜单） */
	onMorePress: () => void;
}

export function HeaderBar({ onMorePress }: Props) {
	const snap = useSnapshot(appStore);
	const server = snap.currentServer;
	const data = server?.data;
	const connected = server?.entity.status === ServiceBridgeStatus.Connected;
	const running = data?.workingStatus === 'running';
	const progress = data?.progress ?? -1;
	const title = progress >= 0 ? `FFBox RN - ${Math.round(progress * 100)}%` : 'FFBox RN';

	const handleStartPause = () => {
		if (connected) appStore.startNpause();
	};
	const handleRangeSelect = async () => {
		const server = appStore.currentServer;
		if (!server || !snap.selectedTask) return;
		// 收集选中任务的 taskIndex，取最小和最大值
		let minIndex = Infinity;
		let maxIndex = -Infinity;
		for (const taskId of snap.selectedTask) {
			const task = server.data.tasks.find(t => t.id === taskId);
			if (task && task.taskIndex !== undefined) {
				if (task.taskIndex < minIndex) minIndex = task.taskIndex;
				if (task.taskIndex > maxIndex) maxIndex = task.taskIndex;
			}
		}
		if (minIndex === Infinity || maxIndex === -Infinity) return;
		const size = maxIndex - minIndex + 1;
		// 通过接口取到区间内的所有任务 ID
		const response = await server.entity.getTaskList(minIndex, size, true);
		if ('taskIds' in response) {
			appStore.selectedTask = new Set(response.taskIds);
		}
	};
	const handleMultiSelect = async () => {
		if (snap.selectedTask) {
			const ids = await appStore.fetchAllTaskIds();	// 虽然目前不做分页查询，本地保留所有任务，但同步 PC 端行为，通过接口取所有 id
			const inverted = new Set(ids);
			for (const id of inverted) {
				if (snap.selectedTask.has(id)) inverted.delete(id);
			}
			appStore.selectedTask = inverted.size === 0 ? undefined : inverted;	// 反选后如果清空了那就退出多选模式
		} else {
			// 进入多选模式
			appStore.selectedTask = new Set();
			appStore.isAllSelected = false;
		}
	};

	return (
		<View style={styles.header}>
			<View style={styles.left}>
				<Text style={styles.ip} numberOfLines={1}>
					{server?.entity.ip || '未连接'}
				</Text>
				<Text style={styles.stats} numberOfLines={1}>
					任务 {data?.totalCount ?? 0} · 信息 {data?.notifications?.length ?? 0} · 异步 {data?.asyncList?.length ?? 0}
				</Text>
			</View>
			<Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
				{title}
			</Text>
			<View style={styles.right}>
				{snap.selectedTask ? (
					<TouchableOpacity style={[styles.btn, styles.textBtn]} onPress={handleRangeSelect} hitSlop={{ top: 6, bottom: 6 }}>
						<Text style={styles.btnText}>区间</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity style={styles.btn} onPress={handleStartPause} disabled={!connected} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
						{running
							? <Text>⏸️</Text>
							: <Text>▶️</Text>}
					</TouchableOpacity>
				)}
				<TouchableOpacity style={[styles.btn, styles.textBtn]} onPress={handleMultiSelect} hitSlop={{ top: 6, bottom: 6 }}>
					<Text style={styles.btnText}>{snap.selectedTask ? '反选' : '多选'}</Text>
				</TouchableOpacity>
				<TouchableOpacity style={styles.btn} onPress={onMorePress} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
					<Ionicons name="ellipsis-horizontal" size={24} color={colors.textMain} />
				</TouchableOpacity>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		height: 54,
		paddingHorizontal: 12,
		backgroundColor: colors.card,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: colors.border,
		...shadows.header,
	},
	left: {
		flexShrink: 1,
		maxWidth: '42%',
	},
	ip: { fontSize: 16, fontWeight: '600', color: colors.textMain },
	stats: { fontSize: 11, color: colors.textSub, marginTop: 2 },
	title: {
		flex: 1,
		textAlign: 'center',
		fontSize: 15,
		fontWeight: '600',
		color: colors.textMain,
		paddingHorizontal: 6,
	},
	right: {
		flexShrink: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	btn: {
		width: 34,
		height: 34,
		alignItems: 'center',
		justifyContent: 'center',
	},
	textBtn: { width: 'auto', paddingHorizontal: 6 },
	btnText: { fontSize: 13, color: colors.primary, fontWeight: '500' },
});
