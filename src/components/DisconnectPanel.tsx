// 移植自 FFBox `MainArea.vue` 的 disconnectArea：掉线时任务列表隐藏，居中显示掉线提示 + 重试按钮。
// 状态：Disconnected（掉线，显示云断开图标）/ Reconnecting（重连中，显示加载动画，重试按钮禁用）
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ServiceBridgeStatus } from '../bridges/serviceBridge';
import { colors } from '../common/theme';

interface Props {
	/** 当前服务器连接状态（由主界面传入） */
	status: ServiceBridgeStatus;
	/** 点击重试按钮（调用 appStore.reConnectServer） */
	onRetry: () => void;
}

export function DisconnectPanel({ status, onRetry }: Props) {
	const reconnecting = status === ServiceBridgeStatus.Reconnecting;

	return (
		<View style={styles.wrap}>
			<View style={styles.box}>
				{reconnecting ? (
					<ActivityIndicator size="large" color={colors.primary} style={styles.svg} />
				) : (
					<Ionicons name="cloud-offline-outline" size={96} color={colors.primary} style={styles.svg} />
				)}
				<Text style={styles.title}>服务器掉线了……</Text>
				{reconnecting && <Text style={styles.subtitle}>正在重新连接…</Text>}
			</View>
			<TouchableOpacity style={[styles.button, reconnecting && styles.buttonDisabled]} onPress={onRetry} disabled={reconnecting}>
				<Text style={styles.buttonText}>{reconnecting ? '连接中…' : '重试'}</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255,255,255,0.6)',
		paddingHorizontal: 24,
	},
	box: {
		alignItems: 'center',
		marginBottom: 32,
	},
	svg: { marginBottom: 16 },
	title: { fontSize: 20, fontWeight: '600', color: colors.textMain },
	subtitle: { fontSize: 13, color: colors.textSub, marginTop: 8 },
	button: {
		minWidth: 120,
		height: 44,
		borderRadius: 10,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
	},
	buttonDisabled: { opacity: 0.6 },
	buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
