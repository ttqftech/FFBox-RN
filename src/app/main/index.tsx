// 移植自 FFBox `MainArea.vue` + `ListArea.vue`，移动端主界面。
// 集成 HeaderBar、TaskItem、MoreMenu、DisconnectPanel、SideDrawer。
// 队列总进度已移至 HeaderBar 标题栏（FFBox - 100%），画面底部不再有进度 footer。
// 步骤 4：画面底部的 drop_files.svg 变为「添加任务」入口，点击弹出文件来源菜单（相册/媒体 或 所有文件）。
//   选文件 → appStore.addTasks（创建任务 + 后台上传）→ 跳转「选择预设」页 → 选中预设 → 「上传进度」页。
import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSnapshot } from 'valtio';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { appStore } from '@/stores/appStore';
import { UITask } from '@/types';
import { colors } from '@/common/theme';
import { defaultParams } from '@/common/defaultParams';
import { ServiceBridgeStatus } from '@/bridges/serviceBridge';
import { HeaderBar } from './_components/HeaderBar';
import { TaskItem } from './_components/TaskItem';
import { MoreMenu } from './_components/MoreMenu';
import { DisconnectPanel } from './_components/DisconnectPanel';
import { SideDrawer } from './_components/SideDrawer';
import type { SideDrawerRef } from './_components/SideDrawer';
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
	const [pickSourceVisible, setPickSourceVisible] = useState(false);
	const [picking, setPicking] = useState(false);
	const drawerRef = useRef<SideDrawerRef>(null);

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

	// #region 添加任务：文件选择 → addTasks → 上传进度页

	/** 相册/媒体选择（image-picker，媒体优先） */
	const handlePickFromGallery = useCallback(async () => {
		if (!connected) {
			Alert.alert('提示', '尚未连接服务器');
			return;
		}
		// iOS 需要相册权限
		const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!perm.granted) {
			Alert.alert('提示', '需要相册权限才能选择媒体文件');
			return;
		}
		const res = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ['images', 'videos'],
			allowsMultipleSelection: true,
			quality: 1,
		});
		if (res.canceled) return;
		const files = res.assets.map((a) => ({
			uri: a.uri,
			name: a.fileName ?? a.uri.split('/').pop() ?? `media_${Date.now()}`,
		}));
		if (!files.length) return;
		setPicking(true);
		try {
			const ids = await appStore.addTasks(files, defaultParams);
			// 创建任务 + 启动上传完成后，先跳「选择预设」页；选中预设后才进入上传进度页
			if (ids.length) router.push('/upload');
			if (ids.length) router.push('/preset');
		} catch (e: any) {
			Alert.alert('添加失败', e?.message || '未知错误');
		} finally {
			setPicking(false);
		}
	}, [connected, router]);

	/** 所有文件选择（document-picker） */
	const handlePickFromFiles = useCallback(async () => {
		if (!connected) {
			Alert.alert('提示', '尚未连接服务器');
			return;
		}
		const res = await DocumentPicker.getDocumentAsync({
			multiple: true,
			copyToCacheDirectory: true,
		});
		if (res.canceled) return;
		const files = res.assets.map((a) => ({ uri: a.uri, name: a.name }));
		if (!files.length) return;
		setPicking(true);
		try {
			const ids = await appStore.addTasks(files, defaultParams);
			// 创建任务 + 启动上传完成后，先跳「选择预设」页；选中预设后才进入上传进度页
			if (ids.length) router.push('/upload');
			if (ids.length) router.push('/preset');
		} catch (e: any) {
			Alert.alert('添加失败', e?.message || '未知错误');
		} finally {
			setPicking(false);
		}
	}, [connected, router]);

	const handlePickSource = useCallback((source: 'gallery' | 'files') => {
		setPickSourceVisible(false);
		if (source === 'gallery') handlePickFromGallery();
		else handlePickFromFiles();
	}, [handlePickFromGallery, handlePickFromFiles]);

	// #endregion

	console.log('tasklist render');
	return (
		<SideDrawer ref={drawerRef} onLogout={handleLogout}>
			<SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
				<HeaderBar onMorePress={() => setMenuVisible(true)} onDrawerOpen={() => drawerRef.current?.openDrawer()} />

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
					<Pressable style={styles.dropFilesDiv} onPress={() => setPickSourceVisible(true)} disabled={picking}>
						{picking ? (
							<Text style={styles.pickingText}>正在添加…</Text>
						) : (
							<View style={styles.svgWrapper}>
								<DropFilesSvg width={260} height={260} />
								<View style={styles.addHint}>
									<Ionicons name="add-circle" size={18} color={colors.primary} />
									<Text style={styles.addHintText}>添加任务</Text>
								</View>
							</View>
						)}
					</Pressable>
				</ScrollView>
	
			)}

			{/* 添加任务：文件来源菜单（相册/媒体 或 所有文件） */}
			<Modal visible={pickSourceVisible} transparent animationType="slide" onRequestClose={() => setPickSourceVisible(false)}>
				<Pressable style={styles.pickBackdrop} onPress={() => setPickSourceVisible(false)}>
					<Pressable style={styles.pickSheet}>
						<View style={styles.pickHandle} />
						<Text style={styles.pickTitle}>添加任务</Text>
						<TouchableOpacityRow icon="images-outline" label="相册 / 媒体" sub="选择照片、视频等媒体文件" onPress={() => handlePickSource('gallery')} />
						<TouchableOpacityRow icon="folder-open-outline" label="所有文件" sub="选择任意类型的文件" onPress={() => handlePickSource('files')} />
						<TouchableOpacity style={styles.pickCancel} onPress={() => setPickSourceVisible(false)}>
							<Text style={styles.pickCancelText}>取消</Text>
						</TouchableOpacity>
					</Pressable>
				</Pressable>
			</Modal>

			<MoreMenu
				visible={menuVisible}
				onClose={() => setMenuVisible(false)}
				onLogout={handleLogout}
			/>
			</SafeAreaView>
		</SideDrawer>
	);
}

/** 文件来源菜单行 */
function TouchableOpacityRow({ icon, label, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; onPress: () => void }) {
	return (
		<TouchableOpacity style={styles.pickItem} onPress={onPress}>
			<Ionicons name={icon} size={22} color={colors.primary} />
			<View style={styles.pickItemBody}>
				<Text style={styles.pickItemLabel}>{label}</Text>
				<Text style={styles.pickItemSub}>{sub}</Text>
			</View>
			<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: colors['bg92'] },
	taskArea: { flexGrow: 1, paddingTop: 20 },
	dropFilesDiv: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 40,
		minHeight: 200,
	},
	svgWrapper: {
		width: 260,
		height: 260,
		opacity: 0.5,
		alignItems: 'center',
		justifyContent: 'center',
	},
	addHint: {
		position: 'absolute',
		bottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		backgroundColor: colors.card,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 12,
		opacity: 1,
	},
	addHintText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
	pickingText: { fontSize: 14, color: colors.textSub },
	pickBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'flex-end',
	},
	pickSheet: {
		backgroundColor: colors.card,
		borderTopLeftRadius: 14,
		borderTopRightRadius: 14,
		paddingBottom: 24,
	},
	pickHandle: {
		alignSelf: 'center',
		width: 36,
		height: 4,
		borderRadius: 2,
		backgroundColor: '#d5d7db',
		marginTop: 8,
		marginBottom: 4,
	},
	pickTitle: {
		fontSize: 13,
		color: colors.textSub,
		textAlign: 'center',
		paddingVertical: 8,
	},
	pickItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 20,
		paddingVertical: 14,
	},
	pickItemBody: { flex: 1 },
	pickItemLabel: { fontSize: 16, color: colors.textMain },
	pickItemSub: { fontSize: 12, color: colors.textSub, marginTop: 2 },
	pickCancel: {
		marginTop: 8,
		marginHorizontal: 20,
		height: 44,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	pickCancelText: { fontSize: 15, color: colors.textMain },
});
