A:\Code\FFBox 是一个转码软件项目，见它的 AGENTS.md。
A:\Code\FFa0x 是我新建的 react-native 项目，用于在移动端实现 FFBox 的部分功能。
具体设计为：

1. 进入后是登录界面，与前端 `src\renderer\src\App\MainFrame\MainArea\MainArea.vue` 一样，4 个框数据 IP 端口用户名密码，支持保存和删除最近使用。但无需像前端那样做成弹出列表，而是在画面下方固定显示一个最近使用的列表即可。
2. 在数据层面上预留多个服务器的可能性，但是暂不实现同时连接多个服务器的功能，只允许连接一个服务器。就像 appStore.servers 只有一个元素。
3. 登录后，进入主界面。以下是主界面描述：
3.1 标题栏。左上角显示：第一行大字体 IP，第二行小字体仿照 `src\renderer\src\App\MainFrame\StatusBar\StatusBar.vue` 显示任务数量、信息数、异步任务数；中间显示“FFBox”；右上角是开始暂停按钮、多选按钮、更多操作按钮。如果实现允许，仿照 FFBox 的 UI 风格做颜色阴影。
3.1.1 多选按钮点击后将切换至选择模式（可以用一个 Set 表示已选任务 id，undefined 表示不在选择模式），该按钮将变成“全选”样式，实际功能是反选。在选择模式下，点击任务列表中的任务将进行选中而不是进入详情页。点击反选按钮将反选所有任务，如果数量为 0 则退出选择模式。你可参考 `src\renderer\src\App\MainFrame\ActionBar\ActionBar.vue` 的全选功能是如何调用接口的，但请按我的描述来做。
3.1.2 操作菜单（未选择状态）有这些选项：
3.1.2.1 按条件选择任务（参考 `src\renderer\src\App\MainFrame\MenuCenter\MenuCenter.vue`）
3.1.2.2 刷新当前服务器信息（参考 `src\renderer\src\App\MainFrame\MenuCenter\MenuCenter.vue`）
3.1.2.3 从当前服务器获取 AVOptions 信息（参考 `src\renderer\src\App\MainFrame\MenuCenter\MenuCenter.vue`）
3.1.2.4 传输中心（跳转页面）
3.1.2.4 退出登录
3.1.2.5 使用条款 弹窗（参考 src\renderer\src\App\MainFrame\MenuCenter\Terms\Terms.vue，无需动态读取这份 LICENSE，直接硬编码在代码中）
3.1.2.6 FFBox 信息 弹窗（参考 src\renderer\src\bizComponents\EnvironmentInfo.tsx）
3.1.3 操作菜单（选择状态）对已选中任务操作。菜单项参考 `src\renderer\src\App\MainFrame\MenuCenter\MenuCenter.vue` 的`已选中任务操作`。
3.1.4 开始暂停按钮功能参考 `src\renderer\src\App\MainFrame\ActionBar\ActionBar.vue`。
3.2 主界面是任务列表。暂不实现无限滚动，直接按最大量取任务列表。列表底部保留一定 padding。空白位置放 `src\renderer\src\App\MainFrame\MainArea\ListArea\drop_files.svg`，点击后将进入添加任务流程。
3.2.1 任务项外观参照 `src\renderer\src\App\MainFrame\MainArea\ListArea\TaskItem\TaskItem.tsx`，整个任务条通过 backgroundProgress 展示进度。可使用 react-native-gesture-handler，在任务条上向左滑，右侧出现操作按钮。非选择情况下，点击进入任务详情页。
3.2.1.1 任务条第一行从左到右展示：状态图标（参考 taskStatusIcon）、任务 id、任务名、进度百分比。
3.2.1.2 任务条第二行从左到右展示：当前输出大小, 时间 `graphTime`, 速度 `graphSpeed`、剩余时间 `graphLeftTime`。
3.2.1.3 操作按钮有两个：第一个是选择预设按钮（参考 appStore.applyParameters 允许修改参数的判断，如果未运行则点击后选择预设修改当前 run，运行时不允许点击，运行后点击后选择预设创建新 run），点击后进入“选择预设”页，选中一个预设后应用到此 run / 新 run。第二个按钮参考 TaskItem 的 `handlePauseNremove`。
3.2.1.4 只展示最新的 run。
3.3 右下角悬浮按钮“预设管理”，搭配适当图标。点击后进入预设管理页。
3.4 如果掉线了，任务列表中的任务将隐藏，只在画面中心展示掉线和重试按钮。
4. 添加任务流程：调用系统文件选择器选择任意类型文件（视框架，优先按相册形式选择媒体文件，同时支持所有文件的选择）。完成后加入上传列表，跳转到“选择预设”页，选中一个预设后应用到此任务，返回任务列表。
5. “选择预设”/“管理预设”：参考 `src\renderer\src\App\MainFrame\MainArea\ParaBox\ShortcutView.tsx`。列表展示所有预设名，右侧各有一个编辑按钮（铅笔图标）（“管理预设”模式下，点击列表项也能进入编辑页）。
6. 以下是编辑预设描述：
6.1 标题栏是返回按钮、“编辑预设”、保存按钮。标题栏下方是预设名输入框。输入框下是 ffmpeg 参数预览（参考 ParaBox 的 globalParamsText），下面是参数设置区域。
6.2 参数设置区域参考 `src\renderer\src\App\MainFrame\MainArea\ParaBox`，一级菜单通过左右滑动的标签页进行切换，支持“输入”、“视频”、“音频”、“封装”四项。
6.3 标签页下的内容参考 ParaBox 下的各个文件进行实现。与 FFBox 不同的是，FFa0x 修改参数后点击“保存”才会保存到预设，不会对任务产生影响。
6.3.1 “输入”参数在 FFBox 中比较独特，有文件列表。FFa0x 中不实现它，文件列表永远是添加任务时选择的唯一文件。只需要像其他标签页那样展示“硬件解码”等等参数即可。
6.3.2 没有“应用参数到全部输入”、“应用参数到全部任务”功能。
7. 传输中心界面参考 `src\renderer\src\App\MainFrame\MainArea\TransferCenter\TransferCenter.vue` 实现，上传逻辑则参考 `src\renderer\src\logic\transferManager2.ts`。注意：react-native 中，上传和下载的 API 可能跟 web/electron 有很大不同。上传下载并非页面功能，而是支持后台运作。
8. 任务信息页内容如下：
8.1 标题栏，展示返回按钮、“任务信息”、操作按钮。这个按钮仅在选择的 run 是最新 run 时才展示。在 idle 状态下点击开始，运行状态下参考 `handlePauseNremove`。idle、finished、error 状态下，左边还额外多出来一个按钮，用于删除任务。
8.2 船型按钮切换当前第 n 次运行的信息（run）。
8.3 基本信息模块。仿照外面任务信息条的 UI，backgroundProgress 展示进度，第一行是任务名，第二行像 FFBox TaskItem 的 paraArea 那样展示信息，第三行是 FFBox TaskItem dashboardArea 的同款 UI 展示时间、帧、码率、速度、输出大小、预计剩余时间、读取总量、校验总量、上传总量、进度
8.4 命令参数模块。纯文本展示 paraArray。
8.5 输出日志模块。纯文本展示 cmdData。
8.6 输出文件模块。outputFiles 列表。如果任务运行成功，点击即可下载输出文件到本地存储。点击前记得申请文件读写权限。
9. 以下是代码层面上的一些要求：
9.1 时刻保持服务器信息监听并更新全局 store，就像 FFBox 那样（软件被切后台了无需手动保活，按默认逻辑）。换句话说，任务列表的数据更新是随时监听的，只有 UI 更新需要待在页面时运行。如果复活时发现掉线，自动重试 1 次。
9.2 原项目使用 Vue，新项目使用 react，数据更新方式差异较大。但界面无关的核心类型尽量保持一致，比如 appStore，原项目使用 Pinia，那么 react-native 中考虑使用类似的响应式库。禁止使用 redux 等复杂且不支持响应式更新的状态管理库。
9.3 避免过度抽象化。最终代码需要由人来编写，请保证代码简洁。建议以 Vue web 开发者的思维思考：应该怎样组织代码结构？应该选用怎样的库和组织方式？
10. 如上述方案中存在遗漏的点，请提醒补充。

请根据以上要求，编写 FFa0x 的实现方案。
1. 该方案要求分步实现，每一步完成后都必须是可运行的，从最小可实现功能开始逐渐完善。未实现的入口保留 TODO 或 UI 提示，避免点击后崩溃。
2. 相关库的选型需列出，并给出示例代码，给出使用该库的理由，以及是否有可替代方案。
3. 给出大体方案文档作为一个 md，以及每一步的方案作为多个 md。
