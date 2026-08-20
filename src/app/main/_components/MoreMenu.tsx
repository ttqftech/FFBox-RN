// 移植自 FFBox `MenuCenter.vue` 的菜单项，用 RN Modal 实现底部操作菜单。
// 未选择状态：按条件选择任务 / 刷新服务器信息 / 获取 AVOptions / 传输中心 / 退出登录 / 使用条款 / FFBox 信息
// 已选择状态（多选模式）：立即开始 / 排队开始 / 停止或重置 / 删除
import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, Pressable } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SvgProps } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { appStore } from '@/stores/appStore';
import { TaskStatus } from '@/common/types';
import { ServiceBridgeStatus } from '@/bridges/serviceBridge';
import { colors } from '@/common/theme';
// 状态图标复用 FFBox 同款 SVG（与 TaskItem 一致）
import IconInitializing from '@/assets/icons/taskStatus/initializing.svg';
import IconIdle from '@/assets/icons/taskStatus/idle.svg';
import IconIdleQueued from '@/assets/icons/taskStatus/idle_queued.svg';
import IconRunning from '@/assets/icons/taskStatus/running.svg';
import IconPaused from '@/assets/icons/taskStatus/paused.svg';
import IconPausedQueued from '@/assets/icons/taskStatus/paused_queued.svg';
import IconStopping from '@/assets/icons/taskStatus/stopping.svg';
import IconFinished from '@/assets/icons/taskStatus/finished.svg';
import IconError from '@/assets/icons/taskStatus/error.svg';
// 菜单项图标：使用条款/FFBox 信息 用 FFBox MenuCenter/term.svg、InfoCenter/info.svg 同款
import IconTerm from '@/assets/icons/term.svg';
import IconInfo from '@/assets/icons/info.svg';

type IoniconName = keyof typeof Ionicons.glyphMap;

const FRONTEND_VERSION = '0.1.0';

const LICENSE_TEXT = `# LICENSE AND TERMS OF USE 使用许可和条款

欢迎您使用 FFBox。您在使用 FFBox 源代码或 FFBox 二进制文件时，需遵循本文件的规定。

FFBox 源代码和二进制文件均免费向所有个体开放。
您可以阅读、拷贝与分发源代码，可以在不进行二次传播和分发的情况下修改、编译源代码并生成二进制文件，可以使用、传播、分发经官方渠道发布且未经修改的二进制文件，可以使用源代码进行二次创作（包括代码分析、与其他软件代码对比，以此为题材制作相关的视频、图文、音频），可以使用二进制文件进行二次创作（包括使用说明和经验分享、与其他软件的对比、纪录、恶搞，以此为题材制作相关的视频、图文、音频），可以使用本软件产品进行二次创作（包括配置文件分享、ffmpeg 输出文件的任何操作）。
以上二次创作均不得涉及软件激活、解锁等相关操作。以上行为除 ffmpeg 输出文件以外均不得进行非官方的盈利操作（包括但不限于篡改收款二维码、销售未经修改或部分修改后的软件与源代码、将二次创作内容放入需要付费开通阅读或观看权限的网站等）。

如果使用者存在或曾经存在以下行为致他人受到未明确作出谅解的伤害，则不得使用 FFBox，亦不得通过他人协助或协助他人的方式使用 FFBox（但若您仅开启了 FFBox 服务，而服务使用者与您并不存在交往，则不受此条款限制）：

- 主观故意地，或反复无意地无中生有、编造他人言论或想法；长期依据虚构事实、片段事件、主观想法认定他人或代表世界
- 对已经被明确指出且具有可改正条件的影响他人的问题，长期、反复地拒绝纠正或补救，并持续造成他人损害
- 以无理由禁止发言、强烈不文明用语、威胁等低劣形式，拒绝必要的理性讨论的进行和结果
- 同时与多个对象维持『任何一方不知情或不同意』的『存在排他期待或事实排他性质的恋爱/准恋爱关系』
- 通过隐瞒、欺骗、误导等方式使他人在错误认知下投入情感、时间或资源以满足自身情感需求
- 对他人进行情感上的信任背离（含背叛、空洞承诺等）行为，包括但不限于明知无法或无意履行时
- 操纵或滥用他人感情（如过度控制或索取、排他性施压等）

FFBox 作者将保留对本许可与使用条款的解释权及随时修改的权利。

*2026-06-07*
`;

// 按条件选择任务的状态选项（参考 MenuCenter.vue），带 FFBox 同款状态图标
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

// 状态 → SVG 图标（对齐 FFBox taskStatusIcon 映射）
const STATUS_ICON_MAP: Record<TaskStatus, React.FC<SvgProps>> = {
	[TaskStatus.initializing]: IconInitializing,
	[TaskStatus.idle]: IconIdle,
	[TaskStatus.idle_queued]: IconIdleQueued,
	[TaskStatus.running]: IconRunning,
	[TaskStatus.paused]: IconPaused,
	[TaskStatus.paused_queued]: IconPausedQueued,
	[TaskStatus.stopping]: IconStopping,
	[TaskStatus.finishing]: IconFinished,
	[TaskStatus.finished]: IconFinished,
	[TaskStatus.error]: IconError,
	[TaskStatus.deleted]: IconIdle,
};

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

	// 按状态着色的 Ionicons（FFBox 无对应图标时使用）
	const actionIcon = (name: IoniconName, danger: boolean, disabled: boolean, size = 20) => (
		<Ionicons name={name} size={size} color={disabled ? colors.textMuted : danger ? colors.red : colors.primary} />
	);

	const menuItem = (key: string, icon: React.ReactNode, label: string, onPress: () => void, danger = false, disabled = false) => (
		<TouchableOpacity key={key} style={[styles.menuItem, disabled && styles.menuItemDisabled]} onPress={onPress} disabled={disabled}>
			{icon}
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
									{menuItem('start', actionIcon('play', false, false), '立即开始', () => handleSelectedAction((ids) => server?.entity.taskStart(ids)))}
									{menuItem('ready', actionIcon('timer-outline', false, false), '排队开始', () => handleSelectedAction((ids) => server?.entity.taskReady(ids)))}
									{menuItem('reset', actionIcon('refresh', false, false), '停止或重置', () => handleSelectedAction((ids) => server?.entity.taskReset(ids)))}
									{menuItem('delete', actionIcon('trash-outline', true, false), '删除', () => handleSelectedAction((ids) => appStore.deleteTasks(ids)), true)}
								</>
							) : (
								<>
									<TouchableOpacity style={styles.menuItem} onPress={() => setShowStatusSub((v) => !v)}>
										<Ionicons name="funnel-outline" size={20} color={colors.primary} />
										<Text style={styles.menuLabel}>按条件选择任务</Text>
										<Ionicons name={showStatusSub ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} style={styles.menuArrow} />
									</TouchableOpacity>
									{showStatusSub && STATUS_OPTIONS.map((opt) => {
										const StatusIcon = STATUS_ICON_MAP[opt.status];
										return (
											<TouchableOpacity key={opt.status} style={styles.menuItemSub} onPress={() => handleSelectByStatus(opt.status)}>
												<StatusIcon width={18} height={18} style={styles.statusIcon} />
												<Text style={styles.menuLabelSub}>{opt.label}</Text>
											</TouchableOpacity>
										);
									})}
									<View style={styles.divider} />
									{menuItem('refresh', actionIcon('refresh', false, !connected), '刷新当前服务器信息', handleRefresh, false, !connected)}
									{menuItem('avoptions', actionIcon('code-slash-outline', false, !connected), '从当前服务器获取 AVOptions', handleFetchAVOptions, false, !connected)}
									{menuItem('transfer', actionIcon('swap-vertical-outline', false, false), '传输中心', handleTransferCenter)}
									<View style={styles.divider} />
									{menuItem('logout', actionIcon('log-out-outline', true, false), '退出登录', onLogout, true)}
									{menuItem('terms', <IconTerm width={20} height={20} color={colors.primary} />, '使用条款', () => setShowTerms(true))}
									{menuItem('env', <IconInfo width={20} height={20} color={colors.primary} />, 'FFBox 信息', () => setShowEnv(true))}
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
								{connected ? `·\n当前后端连接形式：${server?.entity.ip === 'localhost' ? '本地' : '远程'}\n当前后端版本：${server?.data.version ?? '-'}\n当前后端 OS 环境：${server?.data.os ?? '-'}\n当前后端 ffmpeg：${server?.data.ffmpegInfo?.version || '-'}` : '未连接服务器'}
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
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingLeft: 52,
		height: 40,
	},
	statusIcon: { marginRight: 0 },
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
