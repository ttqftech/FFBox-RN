// 参数编辑器基础控件（移动端）。
// 参考 FFBox ParaBox 下各 View 的控件需求，用 RN 内置 + @react-native-community/slider 自建。
import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, StyleSheet, ScrollView, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/common/theme';
import { MenuItem } from '@/common/menu';
import { Parameter } from '@/common/params/parameter';

// #region 菜单扁平化（还原下拉选项，子菜单转为分组标题）

export interface FlatOption {
	label: string;
	value: any;
	group?: string;
}
export function flattenMenu(menu: (MenuItem | FlatOption)[], group?: string): FlatOption[] {
	const out: FlatOption[] = [];
	for (const item of menu) {
		if (!('type' in item)) {
			// 已是扁平选项（无 MenuItem 结构）
			out.push({ label: item.label, value: item.value, group });
			continue;
		}
		if (item.type === 'separator') continue;
		if (item.type === 'submenu') {
			out.push(...flattenMenu(item.subMenu, item.label));
		} else if (item.type === 'normal' || item.type === 'checkbox' || item.type === 'radio') {
			out.push({ label: (item as any).label, value: item.value, group });
		}
	}
	return out;
}

// #endregion

// #region Dropdown

export function Dropdown(props: {
	label: string;
	value: any;
	options: (FlatOption | MenuItem)[] | FlatOption[];
	onChange: (value: any) => void;
}) {
	const [open, setOpen] = useState(false);
	const options: FlatOption[] = flattenMenu(props.options as (FlatOption | MenuItem)[]);
	const current = options.find((o) => o.value === props.value);

	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel} numberOfLines={1}>{props.label}</Text>
			<Pressable style={styles.dropdownTrigger} onPress={() => setOpen(true)}>
				<Text style={styles.dropdownText} numberOfLines={1}>{current?.label ?? (props.value === undefined ? '（空）' : String(props.value))}</Text>
				<Ionicons name="chevron-down" size={16} color={colors.textMuted} />
			</Pressable>
			<Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
				<Pressable style={styles.modalMask} onPress={() => setOpen(false)}>
					<View style={styles.modalCard}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle} numberOfLines={1}>{props.label}</Text>
							<Pressable onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
								<Ionicons name="close" size={22} color={colors.textMain} />
							</Pressable>
						</View>
						<ScrollView style={styles.modalBody}>
							{options.map((opt, i) => {
								if (opt.group && (i === 0 || options[i - 1].group !== opt.group)) {
									return (
										<View key={'g' + i}>
											<View style={styles.groupTitle}><Text style={styles.groupText}>{opt.group}</Text></View>
											<DropdownItem opt={opt} selected={opt.value === props.value} onPick={() => { props.onChange(opt.value); setOpen(false); }} />
										</View>
									);
								}
								return (
									<DropdownItem key={'o' + i} opt={opt} selected={opt.value === props.value}
										onPick={() => { props.onChange(opt.value); setOpen(false); }} />
								);
							})}
						</ScrollView>
					</View>
				</Pressable>
			</Modal>
		</View>
	);
}

function DropdownItem(props: { opt: FlatOption; selected: boolean; onPick: () => void }) {
	return (
		<Pressable style={[styles.dropdownItem, props.selected && styles.dropdownItemSelected]} onPress={props.onPick}>
			<Text style={[styles.dropdownItemText, props.selected && styles.dropdownItemTextSelected]} numberOfLines={1}>{props.opt.label}</Text>
			{props.selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
		</Pressable>
	);
}

// #endregion

// #region Switch

export function ParamSwitch(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel} numberOfLines={1}>{props.label}</Text>
			<Switch value={props.value} onValueChange={props.onChange}
				trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.ff} />
		</View>
	);
}

// #endregion

// #region Slider

/**
 * 简易数值滑块。value 为 detail 中存储的原始数值，display 为右侧展示文本。
 */
export function ParamSlider(props: {
	label: string;
	min: number;
	max: number;
	step?: number;
	value: number;
	display?: string;
	onChange: (v: number) => void;
}) {
	const { min, max, step = 1, value } = props;
	let v = value;
	if (isNaN(v) || v === undefined) v = min;
	return (
		<View style={styles.sliderRow}>
			<View style={styles.sliderHeader}>
				<Text style={styles.rowLabel} numberOfLines={1}>{props.label}</Text>
				<Text style={styles.sliderValue}>{props.display ?? String(v)}</Text>
			</View>
			<Slider
				style={styles.slider}
				minimumValue={min}
				maximumValue={max}
				step={step}
				value={Math.min(Math.max(v, min), max)}
				minimumTrackTintColor={colors.primary}
				maximumTrackTintColor={colors.border}
				thumbTintColor={colors.primary}
				onValueChange={(val) => props.onChange(step >= 1 ? Math.round(val / step) * step : val)}
			/>
		</View>
	);
}

// #endregion

// #region Text

export function ParamText(props: { label: string; value: string; onChange: (v: string) => void }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel} numberOfLines={1}>{props.label}</Text>
			<TextInput
				style={styles.textInput}
				value={props.value}
				onChangeText={props.onChange}
				placeholder="未设置"
				placeholderTextColor={colors.textMuted}
				autoCapitalize="none"
			/>
		</View>
	);
}

// #endregion

// #region 占位

export function ParamPlaceholder(props: { label: string }) {
	return (
		<View style={styles.row}>
			<Text style={styles.rowLabel} numberOfLines={1}>{props.label}</Text>
			<Text style={styles.placeholderText}>（暂未实现）</Text>
		</View>
	);
}

// #endregion

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		paddingVertical: 10,
		paddingHorizontal: 14,
		backgroundColor: colors.card,
		borderRadius: 3,
		marginBottom: 8,
	},
	rowLabel: { fontSize: 14, color: colors.textMain, flexShrink: 1, flex: 1 },
	dropdownTrigger: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		maxWidth: '55%',
		backgroundColor: colors['bg96'],
		borderRadius: 3,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	dropdownText: { fontSize: 13, color: colors.textMain },
	modalMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
	modalCard: { backgroundColor: colors.card, borderRadius: 6, maxHeight: '70%', overflow: 'hidden' },
	modalHeader: {
		flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
		paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors['bg97'],
		borderBottomWidth: 1, borderBottomColor: colors.border,
	},
	modalTitle: { fontSize: 15, fontWeight: '600', color: colors.textMain, flex: 1 },
	modalBody: { paddingVertical: 6 },
	groupTitle: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
	groupText: { fontSize: 12, color: colors.textMuted },
	dropdownItem: {
		flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
		paddingHorizontal: 14, paddingVertical: 10,
	},
	dropdownItemSelected: { backgroundColor: colors.menuItemLight },
	dropdownItemText: { fontSize: 14, color: colors.textMain, flex: 1 },
	dropdownItemTextSelected: { color: colors.primary, fontWeight: '600' },
	sliderRow: { paddingVertical: 8, paddingHorizontal: 14, marginBottom: 8 },
	sliderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
	sliderValue: { fontSize: 13, color: colors.primary, marginLeft: 12 },
	slider: { width: '100%', height: 32 },
	textInput: {
		maxWidth: '55%', backgroundColor: colors['bg96'], borderRadius: 3,
		paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, color: colors.textMain,
	},
	placeholderText: { fontSize: 13, color: colors.textMuted },
});

// 供 renderDetail 复用的类型导出
export type { Parameter };