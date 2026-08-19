// 移植自 FFBox `MenuCenter.vue` 的菜单项，用 RN Modal 实现底部操作菜单。
// 未选择状态：按条件选择任务 / 刷新服务器信息 / 获取 AVOptions / 传输中心 / 退出登录 / 使用条款 / FFBox 信息
// 已选择状态（多选模式）：立即开始 / 排队开始 / 停止或重置 / 删除
import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSnapshot } from 'valtio';
import { appStore } from '../stores/appStore';
import { TaskStatus } from '../common/types';
import { ServiceBridgeStatus } from '../bridges/serviceBridge';
import { colors } from '../common/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

const FRONTEND_VERSION = '0.1.0';

// 使用条款内容（硬编码 FFa0x/LICENSE 的 MIT 文本，参考 FFBox Terms.vue）
const LICENSE_TEXT = `The MIT License (MIT)

Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

// 按条件选择任务的状态选项（参考 MenuCenter.vue）
const STATUS_OPTIONS: { label: string; status: TaskStatus }[] = [
	{ label: '上传中', status: TaskStatus.initializing },
	{ label: '未启动', status: TaskStatus.idle },
	{ label: '排队启动', status: TaskStatus.idle_queued },
	{ label: '运行中', status: TaskStatus.running },
	{ label: '已暂停', status: TaskStatus.paused },
	{ label: '排队继续', status: TaskStatus.paused_queued },
	{ label: '停止中', status: TaskStatus.stopping },
	{ label: '已完成', status: TaskStatus.finished },
	{ label: '出错', status: TaskStatus.error },
];

interface Props {
	visible: boolean;
	onClose: () => void;
	/** 退出登录：断开连接并回登录页（由主界面处理路由） */
	onLogout: () => void;
}

export function MoreMenu({ visible, onClose, onLogout }: Props) {
	const snap = useSnapshot(appStore);
	const server = appStore.currentServer;
	const connected = server?.entity.status === ServiceBridgeStatus.Connected;
	const [showStatusSub, setShowStatusSub] = useState(false);
	const [showTerms, setShowTerms] = useState(false);
	const [showEnv, setShowEnv] = useState(false);

	// #region 未选择状态菜单操作

	const handleSelectByStatus = (status: TaskStatus) => {
		appStore.selectTasksByStatus(status);
		onClose();
	};
	const handleRefresh = () => {
		appStore.updateServerProperties();
		appStore.updateTaskList().catch((e) => console.warn('[MoreMenu] updateTaskList 失败', e));
		appStore.updateNotifications();
		onClose();
	};
	const handleFetchAVOptions = () => {
		if (!server || !connected) return;
		server.entity.getAVOptions().then((result: any) => {
			const codecs = result?.codecs;
			const formats = result?.formats;
			const filters = result?.filters;
			Alert.alert(
				'AVOptions 已获取',
				`已获取 ${codecs?.video?.length ?? 0} 种视频编码、${codecs?.audio?.length ?? 0} 种音频编码、` +
				`${formats?.demuxer?.length ?? 0} 个解复用器、${formats?.muxer?.length ?? 0} 个复用器、` +
				`${filters?.length ?? 0} 个滤镜`
			);
		}).catch((e) => {
			console.warn('[MoreMenu] getAVOptions 失败', e);
			Alert.alert('获取失败', '获取 AVOptions 失败，请检查服务器连接');
		});
		onClose();
	};
	const handleTransferCenter = () => {
		// 传输中心在步骤 7 实现，此处占位
		Alert.alert('传输中心', '传输中心功能将在后续版本提供');
		onClose();
	};

	// #endregion

	// #region 已选择状态菜单操作

	const handleSelectedAction = (action: (ids: number[]) => void) => {
		if (!server || !connected) return;
		action([...snap.selectedTask!]);
		appStore.selectedTask = undefined;
		onClose();
	};

	// #endregion

	const menuItem = (key: string, icon: IoniconName, label: string, onPress: () => void, danger = false, disabled = false) => (
		<TouchableOpacity key={key} style={[styles.menuItem, disabled && styles.menuItemDisabled]} onPress={onPress} disabled={disabled}>
			<Ionicons name={icon} size={20} color={disabled ? colors.textMuted : danger ? colors.red : colors.primary} />
			<Text style={[styles.menuLabel, danger && { color: colors.red }, disabled && { color: colors.textMuted }]}>{label}</Text>
		</TouchableOpacity>
	);

	return (
		<>
			<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
				<Pressable style={styles.backdrop} onPress={onClose}>
					<Pressable style={styles.sheet}>
						<View style={styles.handle} />
						<Text style={styles.sheetTitle}>{snap.selectedTask ? `已选择 ${snap.selectedTask.size} 个任务` : '更多操作'}</Text>
						<ScrollView style={styles.scroll} bounces={false}>
							{snap.selectedTask ? (
								<>
									{menuItem('start', 'play', '立即开始', () => handleSelectedAction((ids) => server?.entity.taskStart(ids)))}
									{menuItem('ready', 'timer-outline', '排队开始', () => handleSelectedAction((ids) => server?.entity.taskReady(ids)))}
									{menuItem('reset', 'refresh', '停止或重置', () => handleSelectedAction((ids) => server?.entity.taskReset(ids)))}
									{menuItem('delete', 'trash-outline', '删除', () => handleSelectedAction((ids) => appStore.deleteTasks(ids)), true)}
								</>
							) : (
								<>
									<TouchableOpacity style={styles.menuItem} onPress={() => setShowStatusSub((v) => !v)}>
										<Ionicons name="funnel-outline" size={20} color={colors.primary} />
										<Text style={styles.menuLabel}>按条件选择任务</Text>
										<Ionicons name={showStatusSub ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} style={styles.menuArrow} />
									</TouchableOpacity>
									{showStatusSub && STATUS_OPTIONS.map((opt) => (
										<TouchableOpacity key={opt.status} style={styles.menuItemSub} onPress={() => handleSelectByStatus(opt.status)}>
											<Text style={styles.menuLabelSub}>{opt.label}</Text>
										</TouchableOpacity>
									))}
									<View style={styles.divider} />
									{menuItem('refresh', 'refresh', '刷新当前服务器信息', handleRefresh, false, !connected)}
									{menuItem('avoptions', 'code-slash-outline', '从当前服务器获取 AVOptions', handleFetchAVOptions, false, !connected)}
									{menuItem('transfer', 'swap-vertical-outline', '传输中心', handleTransferCenter)}
									<View style={styles.divider} />
									{menuItem('logout', 'log-out-outline', '退出登录', onLogout, true)}
									{menuItem('terms', 'document-text-outline', '使用条款', () => setShowTerms(true))}
									{menuItem('env', 'information-circle-outline', 'FFBox 信息', () => setShowEnv(true))}
								</>
							)}
						</ScrollView>
					</Pressable>
				</Pressable>
			</Modal>

			{/* 使用条款 */}
			<Modal visible={showTerms} transparent animationType="fade" onRequestClose={() => setShowTerms(false)}>
				<Pressable style={styles.dialogBackdrop} onPress={() => setShowTerms(false)}>
					<Pressable style={styles.dialog}>
						<Text style={styles.dialogTitle}>使用条款</Text>
						<ScrollView style={styles.dialogBody}>
							<Text style={styles.dialogText}>{LICENSE_TEXT}</Text>
						</ScrollView>
						<TouchableOpacity style={styles.dialogButton} onPress={() => setShowTerms(false)}>
							<Text style={styles.dialogButtonText}>关闭</Text>
						</TouchableOpacity>
					</Pressable>
				</Pressable>
			</Modal>

			{/* FFBox 信息（参考 EnvironmentInfo.tsx） */}
			<Modal visible={showEnv} transparent animationType="fade" onRequestClose={() => setShowEnv(false)}>
				<Pressable style={styles.dialogBackdrop} onPress={() => setShowEnv(false)}>
					<Pressable style={styles.dialog}>
						<Text style={styles.dialogTitle}>版本信息</Text>
						<ScrollView style={styles.dialogBody}>
							<Text style={styles.dialogText}>
								前端版本：{FRONTEND_VERSION}{'\n'}
								前端 OS 环境：{Platform.OS}{'\n'}
								{connected ? `·\n当前后端连接形式：${server?.entity.ip === 'localhost' ? '本地' : '远程'}{'\n'}当前后端版本：${server?.data.version ?? '-'}{'\n'}当前后端 OS 环境：${server?.data.os ?? '-'}{'\n'}当前后端 ffmpeg：${server?.data.ffmpegInfo?.version || '-'}` : '未连接服务器'}
							</Text>
						</ScrollView>
						<TouchableOpacity style={styles.dialogButton} onPress={() => setShowEnv(false)}>
							<Text style={styles.dialogButtonText}>关闭</Text>
						</TouchableOpacity>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'flex-end',
	},
	sheet: {
		backgroundColor: colors.card,
		borderTopLeftRadius: 14,
		borderTopRightRadius: 14,
		paddingBottom: 24,
		maxHeight: '70%',
	},
	handle: {
		alignSelf: 'center',
		width: 36,
		height: 4,
		borderRadius: 2,
		backgroundColor: '#d5d7db',
		marginTop: 8,
		marginBottom: 4,
	},
	sheetTitle: {
		fontSize: 13,
		color: colors.textSub,
		textAlign: 'center',
		paddingVertical: 8,
	},
	scroll: { flexGrow: 0 },
	menuItem: {
		flexDirection: 'row',
		alignItems: 'center',
		height: 48,
		paddingHorizontal: 20,
		gap: 10,
	},
	menuItemDisabled: { opacity: 0.5 },
	menuLabel: { flex: 1, fontSize: 15, color: colors.textMain },
	menuArrow: { marginRight: 4 },
	menuItemSub: {
		paddingLeft: 52,
		height: 40,
		justifyContent: 'center',
	},
	menuLabelSub: { fontSize: 14, color: colors.textMain },
	divider: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: colors.border,
		marginHorizontal: 16,
	},
	dialogBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.4)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 32,
	},
	dialog: {
		width: '100%',
		maxWidth: 420,
		backgroundColor: colors.card,
		borderRadius: 12,
		padding: 20,
	},
	dialogTitle: { fontSize: 17, fontWeight: '600', color: colors.textMain, textAlign: 'center', marginBottom: 12 },
	dialogBody: { maxHeight: 320 },
	dialogText: { fontSize: 13, lineHeight: 20, color: colors.textMain },
	dialogButton: {
		marginTop: 16,
		height: 40,
		borderRadius: 8,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
	},
	dialogButtonText: { color: '#fff', fontSize: 15, fontWeight: '500' },
});