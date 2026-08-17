// 移植自 FFBox `src/common/formatUtils.ts` 的 parseTime，仅保留移动端所需部分。

/**
 * 把 "时:分:秒(.毫)" 或 "分:秒(.毫)" 形式的字符串解析为秒数。
 * 解析失败返回 -1。
 */
export function parseTime(timeString: string): number {
	if (timeString === 'N/A') {
		return -1;
	}
	let exp: RegExpExecArray | null;
	if (exp = /^(\d+):([0-5]?[0-9]):([0-5]?[0-9])(.\d+)?$/.exec(timeString)) {
		// (时):(分):(秒)(.小)
		const hour = Number(exp[1]);
		const minute = Number(exp[2]);
		const second = Number(exp[3]);
		const mili = Number(exp[4] ?? '0');
		if (minute >= 60 || second >= 60) {
			return -1;
		}
		return hour * 3600 + minute * 60 + second + Number(mili);
	} else if (exp = /^([0-5]?[0-9]):([0-5]?[0-9])(.\d+)?$/.exec(timeString)) {
		// (分):(秒)(.小)
		const minute = Number(exp[1]);
		const second = Number(exp[2]);
		const mili = Number(exp[3] ?? '0');
		if (minute >= 60 || second >= 60) {
			return -1;
		}
		return minute * 60 + second + Number(mili);
	}
	return -1;
}
