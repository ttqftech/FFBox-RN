// 移植自 FFBox `MainArea.vue` 的 disconnectArea：掉线时任务列表隐藏，居中显示掉线提示 + 重试按钮。
// 状态：Disconnected（掉线，显示云断开图标）/ Reconnecting（重连中，显示加载动画，重试按钮禁用）
import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { ServiceBridgeStatus } from '@/bridges/serviceBridge';
import { colors } from '@/common/theme';
import IconLoading from '@/assets/icons/loading.svg';
import IconDisconnect from '@/assets/icons/disconnect.svg';

interface Props {
	/** 当前服务器连接状态（由主界面传入） */
	status: ServiceBridgeStatus;
	/** 点击重试按钮（调用 appStore.reConnectServer） */
	onRetry: () => void;
}

export function DisconnectPanel({ status, onRetry }: Props) {
	const reconnecting = status === ServiceBridgeStatus.Reconnecting;

	const rotation = useRef(new Animated.Value(0)).current;
	const stepRef = useRef(0);

	useEffect(() => {
		if (reconnecting) {
			const stepDeg = 360 / 8;
			stepRef.current = 0;
			const timer = setInterval(() => {
				stepRef.current = (stepRef.current + 1) % 8;
				rotation.setValue(stepRef.current * stepDeg);
			}, 150);
			return () => clearInterval(timer);
		} else {
			rotation.setValue(0);
		}
	}, [reconnecting]);

	const rotateStr = rotation.interpolate({
		inputRange: [0, 360],
		outputRange: ['0deg', '360deg'],
	});
	console.log(rotation, rotateStr);

	return (
		<View style={styles.wrap}>
			<View style={styles.box}>
				{reconnecting ? (
					<Animated.View style={[styles.svg, { transform: [{ rotate: rotateStr }] }]}>
						<IconLoading width={200} height={200} />
					</Animated.View>
				) : (
					<IconDisconnect width={200} height={200} style={styles.svg} />
				)}
				<Text style={styles.title}>服务器掉线了……</Text>
				{/* {reconnecting && <Text style={styles.subtitle}>正在重新连接…</Text>} */}
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
