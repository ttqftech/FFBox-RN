// 移植自 FFBox `src/common/formatUtils.ts`，仅保留移动端所需部分。
// 移动端无 useIEC 前端设置，尺寸/码率统一使用 1000 进制（useIEC=false）。

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

/**
 * 将秒数格式化为人类可读时间（移植自 FFBox `formatTime`）。
 * - style='display'：h:mm:ss / m:ss.s / ss.ss
 * - style='compact'：h:mm:ss / m:ss / N s
 * - style='ffmpeg'：HH:MM:SS.xx（FFmpeg 可直接解析）
 */
export function formatTime(seconds: number, style: 'display' | 'compact' | 'ffmpeg'): string {
	// NaN / -1 视作"未知时长"
	if (isNaN(seconds) || seconds === -1) {
		return '时长未知';
	}

	const hour = Math.floor(seconds / 3600);
	const minute = Math.floor((seconds - hour * 3600) / 60);
	const second = seconds - hour * 3600 - minute * 60;

	if (style === 'ffmpeg') {
		// HH:MM:SS.xx — 全程补零，2 位小数，FFmpeg 可直接解析
		return ('0' + hour).slice(-2) + ':' + ('0' + minute).slice(-2) + ':' + ('0' + second.toFixed(2)).slice(-5);
	}

	// 以下为人类可读风格（不补零）
	if (hour) {
		return `${hour}:${minute.toString().padStart(2, '0')}:${second.toFixed(0).toString().padStart(2, '0')}`;
	} else if (minute) {
		if (style === 'compact') {
			return `${minute}:${second.toFixed(0).padStart(2, '0')}`;
		}
		return `${minute}:${second.toFixed(1).padStart(4, '0')}`;
	} else {
		if (style === 'compact') {
			return `${second.toFixed(0)} s`;
		}
		return second.toFixed(2);
	}
}

/**
 * 将字节大小转换为人类可读数字（移植自 FFBox `formatSize`）
 */
export function formatSize(B: number, useIEC?: boolean) {
	if (useIEC) {
		if (B >= 10 * 1024 ** 3) {
			return (B / 1024 ** 3).toFixed(1) + ' GiB';
		} else if (B >= 1024 ** 3) {
			return (B / 1024 ** 3).toFixed(2) + ' GiB';
		} else if (B >= 100 * 1024 ** 2) {
			return (B / 1024 ** 2).toFixed(0) + ' MiB';
		} else if (B >= 10 * 1024 ** 2) {
			return (B / 1024 ** 2).toFixed(1) + ' MiB';
		} else {
			return (B / 1024 ** 2).toFixed(2) + ' MiB';
		}
	} else {
		if (B >= 10 * 1000 ** 3) {
			return (B / 1000 ** 3).toFixed(1) + ' GB';
		} else if (B >= 1000 ** 3) {
			return (B / 1000 ** 3).toFixed(2) + ' GB';
		} else if (B >= 100 * 1000 ** 2) {
			return (B / 1000 ** 2).toFixed(0) + ' MB';
		} else if (B >= 10 * 1000 ** 2) {
			return (B / 1000 ** 2).toFixed(1) + ' MB';
		} else {
			return (B / 1000 ** 2).toFixed(2) + ' MB';
		}
	}
}

/**
 * 码率（bit/s）格式化（移植自 FFBox `formatBitrate`）
 */
export function formatBitrate(bps: number, useIEC?: boolean): string {
	const unit = useIEC ? 1024 : 1000;
	if (bps >= 10 * unit ** 2) {
		return (bps / unit ** 2).toFixed(1) + ' ' + (useIEC ? 'Mibps' : 'Mbps');
	} else {
		return (bps / unit).toFixed(0) + ' ' + (useIEC ? 'kibps' : 'kbps');
	}
}

/**
 * 转码速度格式化（移植自 FFBox TaskItem 的 graphSpeed）：
 * 倍率越大保留位数越少：>=10 → x.x，>=1 → x.x，<1 → x.xx
 */
export function formatSpeed(value: number): string {
	return value >= 10 ? value.toFixed(0) + '×' : (value >= 1 ? value.toFixed(1) + '×' : value.toFixed(2) + '×');
}

/**
 * 预计剩余时间（移植自 FFBox TaskItem 的 graphLeftTime）：
 * 依据总时长、当前时间与速度估算剩余时长，格式为 compact。
 */
export function formatLeftTime(totalDuration: number, dashboardTime: number, dashboardSpeed: number): string {
	if (dashboardSpeed > 0) {
		const needTime = totalDuration / dashboardSpeed;
		const remainTime = (totalDuration - dashboardTime) / totalDuration * needTime;	// 剩余进度比例 * 全进度耗时
		return formatTime(remainTime, 'compact');
	}
	return '-';
}
