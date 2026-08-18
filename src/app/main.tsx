// 移植自 FFBox `MainArea.vue` + `ListArea.vue`，移动端主界面。
// 集成 HeaderBar、TaskItem、MoreMenu、DisconnectPanel。
// 队列总进度已移至 HeaderBar 标题栏（FFBox - 100%），画面底部不再有进度 footer。
import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSnapshot } from 'valtio';
import { appStore } from '../stores/appStore';
import { ServiceBridgeStatus } from '../bridges/serviceBridge';
import { HeaderBar } from '../components/HeaderBar';
import { TaskItem } from '../components/TaskItem';
import { MoreMenu } from '../components/MoreMenu';
import { DisconnectPanel } from '../components/DisconnectPanel';
import { DropFilesIcon } from '../components/DropFilesIcon';
import { UITask } from '../types';
import { colors } from '../common/theme';

export default function MainScreen() {
	const router = useRouter();
	const snap = useSnapshot(appStore);
	const server = snap.currentServer;
	const connected = server?.entity.status === ServiceBridgeStatus.Connected;
	const disconnected = !connected && (
		server?.entity.status === ServiceBridgeStatus.Disconnected ||
		server?.entity.status === ServiceBridgeStatus.Reconnecting
	);
	const tasks = (server?.data.tasks ?? []) as UITask[];
	const [menuVisible, setMenuVisible] = useState(false);

	const handleLogout = useCallback(() => {
		if (server) appStore.removeServer(server.data.id);
		setMenuVisible(false);
		router.replace('/');
	}, [server, router]);

	const handleTaskPress = useCallback((task: UITask) => {
		// 任务详情页在步骤 6 实现，此处占位
		// router.push(`/task/${task.id}`);
	}, []);

	const handleReconnect = useCallback(() => {
		if (server) appStore.reConnectServer(server.data.id);
	}, [server]);

	// 渲染单个任务
	const renderTask = ({ item }: { item: UITask }) => (
		<TaskItem task={item} onPress={handleTaskPress} />
	);

	// 空列表（无任务时显示 drop_files 占位）
	const renderEmpty = () => (
		<Pressable style={styles.emptyWrap}>
			<View style={styles.emptySvg}>
				<DropFilesIcon size={260} />
			</View>
			<Text style={styles.emptyText}>拖放一个/多个多媒体文件到这里</Text>
			<Text style={styles.emptySub}>或点击此处添加任务</Text>
		</Pressable>
	);

	const keyExtractor = useCallback((t: UITask) => String(t.id), []);

	return (
		<SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
			<HeaderBar onMorePress={() => setMenuVisible(true)} />

			{/* 掉线面板 */}
			{disconnected ? (
				<DisconnectPanel
					status={server!.entity.status}
					onRetry={handleReconnect}
				/>
			) : (
				<FlatList
					data={tasks}
					keyExtractor={keyExtractor}
					renderItem={renderTask}
					ListEmptyComponent={renderEmpty}
					contentContainerStyle={tasks.length === 0 ? styles.emptyList : styles.list}
				/>
			)}

			<MoreMenu
				visible={menuVisible}
				onClose={() => setMenuVisible(false)}
				onLogout={handleLogout}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: colors.bg },
	list: { padding: 10 },
	emptyList: { flexGrow: 1 },
	emptyWrap: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 40,
	},
	emptySvg: {
		width: 260,
		height: 260,
		marginBottom: 16,
		opacity: 0.5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyText: { fontSize: 15, color: colors.textSub, textAlign: 'center' },
	emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});