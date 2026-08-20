// 移植自 FFBox `MainArea.vue` + `ListArea.vue`，移动端主界面。
// 集成 HeaderBar、TaskItem、MoreMenu、DisconnectPanel。
// 队列总进度已移至 HeaderBar 标题栏（FFBox - 100%），画面底部不再有进度 footer。
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSnapshot } from 'valtio';
import { appStore } from '@/stores/appStore';
import { UITask } from '@/types';
import { colors } from '@/common/theme';
import { ServiceBridgeStatus } from '@/bridges/serviceBridge';
import { HeaderBar } from './_components/HeaderBar';
import { TaskItem } from './_components/TaskItem';
import { MoreMenu } from './_components/MoreMenu';
import { DisconnectPanel } from './_components/DisconnectPanel';
import DropFilesSvg from './_components/drop_files.svg';

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

	const handleTaskPress = useCallback((taskId: number) => {
		// 任务详情页在步骤 6 实现，此处占位
		// router.push(`/task/${taskId}`);
	}, []);

	const handleReconnect = useCallback(() => {
		if (server) appStore.reConnectServer(server.data.id);
	}, [server]);

	console.log('tasklist render');
	return (
		<SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
			<HeaderBar onMorePress={() => setMenuVisible(true)} />

			{disconnected ? (
				<DisconnectPanel
					status={server!.entity.status}
					onRetry={handleReconnect}
				/>
			) : (
				<ScrollView style={{}} contentContainerStyle={styles.taskArea}>
					{tasks.map(task => (
						<TaskItem
							key={task.id}
							taskId={task.id}
							isSelected={!!snap.selectedTask && snap.selectedTask.has(task.id)}
							onPress={handleTaskPress}
						/>
					))}
					<Pressable style={styles.dropFilesDiv}>
						<View style={styles.svgWrapper}>
							<DropFilesSvg width={260} height={260} />
						</View>
					</Pressable>
				</ScrollView>
	
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
	taskArea: { flexGrow: 1, padding: 8 },
	dropFilesDiv: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 40,
	},
	svgWrapper: {
		width: 260,
		height: 260,
		opacity: 0.5,
	},
});
