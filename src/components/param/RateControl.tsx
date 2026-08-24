// 码率控制（RateControl）组件：下拉选择控制模式 + 滑块设置具体值。
// 参考 FFBox ParaBox 的 VcodecView/AcodecView 对 rateControl 的处理。
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/common/theme';
import { MenuItem } from '@/common/menu';
import { RateControl } from '@/common/params/parameter';
import { Dropdown, ParamSlider } from './ParamControls';
import formatUtils from '@/common/formatUtils';

/** 由滑块值计算展示文本 */
export function rateControlDisplay(rc: RateControl, sliderValue: number | undefined): string {
	if (sliderValue === undefined) return '';
	const vtt = rc.valueToDisplay;
	if (vtt instanceof Function) return String(vtt(sliderValue));
	const max = rc.max ?? 100;
	if (vtt?.type === 'bitrate') return formatUtils.bitrate(Math.round((vtt.base ?? 0) * 2 ** sliderValue), false);
	if (vtt?.type === 'revertInteger') return (max - sliderValue).toFixed(0);
	if (vtt?.type === 'integer') return sliderValue.toFixed(0);
	return String(sliderValue);
}

export default function RateControlEditor(props: {
	rateControl: MenuItem<RateControl>[];
	ratecontrol: string;                 // 当前选中的模式（如 'CRF'）
	detail: Record<string, any>;         // 当前 detail
	onRateControlChange: (mode: string) => void;   // 切换模式
	onDetailPatch: (name: string, value: any) => void; // 写入 detail
}) {
	if (!props.rateControl?.length) {
		return null;
	}
	// 找到当前选中的 RateControl 定义
	const current = props.rateControl.find((it) => it.type === 'normal' && it.value === props.ratecontrol) as any;
	if (!current) {
		return null;
	}
	const rc = current.extra as RateControl;
	let sliderValue = rc.detailToSliderValue(props.detail);
	if (sliderValue === undefined) {
		// 用默认 detail 初始值
		const seeded = { ...props.detail };
		for (const n of rc.paramNames) if (!(n in seeded)) seeded[n] = rc.defaultDetail[n];
		sliderValue = rc.detailToSliderValue(seeded);
	}
	const display = rateControlDisplay(rc, sliderValue);
	const min = rc.min ?? 0;
	const max = rc.max ?? 100;

	return (
		<View style={styles.block}>
			<Dropdown label="码率控制"
				value={props.ratecontrol}
				options={props.rateControl}
				onChange={(mode) => props.onRateControlChange(mode)} />
			<ParamSlider label={current.label}
				min={min} max={max} step={1}
				value={sliderValue ?? (rc.defaultDetail as any)[rc.paramNames[0]] ?? min}
				display={display}
				onChange={(v) => {
					// 清掉该模式占用的旧参数，再写入新模式的值
					for (const n of rc.paramNames) props.onDetailPatch(n, undefined);
					const patch = rc.sliderParamToDetail(v);
					for (const [k, val] of Object.entries(patch)) props.onDetailPatch(k, val as any);
				}} />
			{/* 滑块两端刻度提示 */}
			<View style={styles.tagsRow}>
				{rc.tags ? [...rc.tags.entries()].map(([tv, tag]) => (
					<Text key={tv} style={styles.tag}>{tag}</Text>
				)) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	block: { marginBottom: 6 },
	tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 6 },
	tag: { fontSize: 11, color: colors.textMuted },
});