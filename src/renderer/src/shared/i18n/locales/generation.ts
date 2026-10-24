// Provides current task status and duration labels for conversation history.
export const generationZh = {
  status: { idle: "暂无任务", queued: "排队中", running: "运行中", completed: "已完成", failed: "失败", cancelled: "已取消", interrupted: "服务中断", unknown: "未知状态" },
  taskKinds: { unknown: "项目生成任务" },
  drawer: { seconds: "{{count}} 秒", minutes: "{{count}} 分钟", minuteSeconds: "{{minutes}} 分 {{seconds}} 秒" },
};
export const generationEn = {
  status: { idle: "No tasks", queued: "Queued", running: "Running", completed: "Completed", failed: "Failed", cancelled: "Cancelled", interrupted: "Interrupted", unknown: "Unknown" },
  taskKinds: { unknown: "Project generation task" },
  drawer: { seconds: "{{count}}s", minutes: "{{count}}m", minuteSeconds: "{{minutes}}m {{seconds}}s" },
};
