// 原生端：直接复用 react-native-pager-view（左右滑动标签页）。
// web 端：Metro 会优先解析 `PagerView.web.tsx`（见同目录下 shim），避免打包原生 codegen 失败。
export { default as PagerView } from 'react-native-pager-view';
export type { PagerViewProps, PagerViewOnPageSelectedEvent } from 'react-native-pager-view';