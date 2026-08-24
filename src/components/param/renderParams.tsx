// 通用参数渲染器：根据某个编码器/复用器的 Parameter[] 列表渲染一组控件到 detail。
// 参考 FFBox ParaBox 下各 View：switch / combo(下拉) / slider(滑块) / text(输入)。
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/common/theme';
import { Parameter } from '@/common/params/parameter';
import formatUtils from '@/common/formatUtils';
import { Dropdown, ParamSwitch, ParamSlider, ParamText, ParamPlaceholder } from './ParamControls';

/** 计算滑块的展示文本 */
function sliderDisplay(parameter: Parameter & { mode: 'slider' }, value: number | string | undefined): string {
	const vtt = parameter.valueToDisplay;
	if (vtt instanceof Function) return String(vtt(value));
	if (value === undefined) return '';
	if (typeof value === 'string') {
		// 字符串值：尝试从 tags 反查标签
		for (const [k, label] of parameter.tags ?? new Map()) {
			if (parameter.valueToParam ? String(parameter.valueToParam(k)) === value : String(k) === value) return label;
		}
		return value;
	}
	const max = parameter.max ?? 100;
	if (vtt?.type === 'bitrate') return formatUtils.bitrate(Math.round((vtt.base ?? 0) * 2 ** value), false);
	if (vtt?.type === 'revertInteger') return (max - value).toFixed(0);
	if (vtt?.type === 'integer') return value.toFixed(0);
	return String(value);
}

/**
 * 渲染一组参数到指定 detail。
 * @param parameters  参数定义列表
 * @param detail      当前值对象（会被原地读取）
 * @param onPatch     (name, value) 写入；value 为 undefined 表示删除该参数
 */
export function renderParams(parameters: Parameter[], detail: Record<string, any>, onPatch: (name: string, value: any) => void) {
	return parameters.map((p, idx) => {
		const key = p.parameter + idx;
		if (p.mode === 'switch') {
			return (
				<ParamSwitch key={key} label={p.display}
					value={!!detail[p.parameter]}
					onChange={(v) => onPatch(p.parameter, v ? true : undefined)} />
			);
		}
		if (p.mode === 'combo') {
			return (
				<Dropdown key={key} label={p.display}
					value={detail[p.parameter]}
					options={p.items}
					onChange={(v) => onPatch(p.parameter, v)} />
			);
		}
		if (p.mode === 'slider') {
			const raw = detail[p.parameter];
			const min = p.min ?? 0;
			const max = p.max ?? 100;
			const step = p.adsorption === 'int' ? 1 : 1;
			if (typeof raw === 'number') {
				return (
					<ParamSlider key={key} label={p.display} min={min} max={max} step={step}
						value={raw} display={sliderDisplay(p, raw)}
						onChange={(v) => onPatch(p.parameter, v)} />
				);
			}
			if (raw === undefined && typeof p.default === 'number') {
				// 默认数值（尚未写入 detail）也按滑块渲染
				return (
					<ParamSlider key={key} label={p.display} min={min} max={max} step={step}
						value={p.default} display={sliderDisplay(p, p.default)}
						onChange={(v) => onPatch(p.parameter, v)} />
				);
			}
			// 字符串型滑块（如 tags 列表）：用下拉选择标签
			if (p.tags && p.tags.size) {
				const opts = [...p.tags.entries()].map(([v, label]) => ({ value: p.valueToParam ? p.valueToParam(v) : v, label }));
				return (
					<Dropdown key={key} label={p.display}
						value={raw}
						options={opts}
						onChange={(v) => onPatch(p.parameter, v)} />
				);
			}
			return <ParamPlaceholder key={key} label={p.display} />;
		}
		if (p.mode === 'text') {
			return (
				<ParamText key={key} label={p.display}
					value={detail[p.parameter] ?? ''}
					onChange={(v) => onPatch(p.parameter, v || undefined)} />
			);
		}
		return (
			<View key={key} style={styles.row}>
				<Text style={styles.label}>{(p as any).display}</Text>
			</View>
		);
	});
}

const styles = StyleSheet.create({
	row: { paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8, backgroundColor: colors.card, borderRadius: 3 },
	label: { fontSize: 14, color: colors.textMain },
});