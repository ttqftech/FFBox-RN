// 移植自 FFBox `src/common/path.ts`（基于 path-browserify）。
// 移动端不引入 path-browserify，这里用极简实现替代 dirname/basename/extname，
// 同时兼容 `/`（移动/网络）与 `\`（Windows 桌面）分隔符。

export function extname(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	const lastSep = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
	if (lastDot === -1 || lastDot <= lastSep + 1) {
		return '';
	}
	return filename.slice(lastDot);
}

export function dirname(filename: string): string {
	// 去掉末尾的分隔符（保留根路径）
	let path = filename.replace(/[/\\]+$/, '');
	const i = path.lastIndexOf('/');
	const j = path.lastIndexOf('\\');
	const idx = Math.max(i, j);
	if (idx === -1) return '.';
	if (idx === 0) return path.slice(0, 1);	// 根目录 "/" 或 "\"
	return path.slice(0, idx);
}

export function basename(filename: string): string {
	const path = filename.replace(/[/\\]+$/, '');
	const i = path.lastIndexOf('/');
	const j = path.lastIndexOf('\\');
	const idx = Math.max(i, j);
	return idx === -1 ? path : path.slice(idx + 1);
}

export function parse(filename: string) {
	const dir = dirname(filename);
	const base = basename(filename);
	const ext = extname(base);
	return {
		root: '',
		dir,
		base,
		ext,
		name: ext ? base.slice(0, base.length - ext.length) : base,
	};
}

const isValidExt = function (ext: string, ignoreExts: any, maxSize: number) {
	if (ignoreExts == null) {
		ignoreExts = [];
	}
	const normalized: string[] = ignoreExts.map((e: any) => (e && e[0] !== '.' ? '.' : '') + e);
	return !!ext && ext.length <= maxSize && normalized.indexOf(ext) < 0;
};

export default {
	trimExt(filename: string, ignoreExts?: any, maxSize?: number) {
		let oldExt;
		if (maxSize == null) {
			maxSize = 7;
		}
		oldExt = extname(filename);
		if (isValidExt(oldExt, ignoreExts, maxSize)) {
			return filename.slice(0, +(filename.length - oldExt.length - 1) + 1 || 9000000000);
		} else {
			return filename;
		}
	},
	basename,
	dirname,
	parse,
};