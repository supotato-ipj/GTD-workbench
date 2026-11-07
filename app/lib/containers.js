/**
 * 工作台的纸箱与它们在滴答里的清单。
 *
 * 纸箱名用 GLOSSARY「工作台用语」/ ADR-0007 的写法（收集箱、项目、执行、等待、日历、可能）；
 * listName 是滴答里那份清单的**原名**，两者一一对应，便于核对（spec「接缝 A」）。
 * projectId 一律用**完整的 24 位 id**——`dida project list` 给的 id 被截断成 22 位，不能用。
 */

/** 收集箱在滴答里就是 inbox，没有 project id。 */
export const INBOX_PROJECT_ID = 'inbox9000000001';

/** 六个纸箱，顺序固定：收集箱、项目、执行、等待、日历、可能（ADR-0007）。 */
export const CONTAINERS = [
  { key: 'inbox', name: '收集箱', listName: '收集箱', projectId: INBOX_PROJECT_ID },
  { key: 'project', name: '项目', listName: '项目清单', projectId: '7c4e00000000000000000000' },
  { key: 'execution', name: '执行', listName: '执行清单', projectId: '7c4e00000000000000000002' },
  { key: 'waiting', name: '等待', listName: '等待清单', projectId: '7c4e00000000000000000001' },
  { key: 'calendar', name: '日历', listName: '待办日历', projectId: '7c4e00000000000000000003' },
  { key: 'maybe', name: '可能', listName: '💭可能', projectId: '7c4e00000000000000000010' },
];

/**
 * 本票（工单 01：一条动作走通全程）只打通「执行清单」一个容器。
 * 其余五个容器在工单 02 接入——一次拉全部容器会撞上单次 200 条上限，必须分容器调用。
 */
export const EXECUTION_CONTAINER = CONTAINERS.find((container) => container.key === 'execution');
