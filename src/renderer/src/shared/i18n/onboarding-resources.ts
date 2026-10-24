// Provides bilingual copy for the first-use workspace and project tours.
export const onboardingZh = {
  onboarding: {
    replay: "查看引导",
    dialogLabel: "工作台引导",
    progress: "第 {{current}} / {{total}} 步",
    previous: "上一步",
    next: "下一步",
    skip: "跳过引导",
    finish: "完成引导",
    saveFailed: "引导状态未能保存，下次登录时可能再次出现。",
    startFailed: "暂时无法打开引导，请刷新页面后重试。",
    empty: {
      overview: { title: "从项目开始", content: "每个项目都有自己的需求、模型、代码和说明书。创建项目后，工作台会汇集整个开发过程。" },
      create: { title: "创建第一个项目", content: "从这里打开创建表单，填写项目名称和背景，再设置可见范围。完成创建后会直接进入项目工作台。" },
    },
  },
} as const;

export const onboardingEn = {
  onboarding: {
    replay: "View guide",
    dialogLabel: "Workspace guide",
    progress: "Step {{current}} of {{total}}",
    previous: "Previous",
    next: "Next",
    skip: "Skip guide",
    finish: "Finish guide",
    saveFailed: "Your guide progress could not be saved and may appear again next time.",
    startFailed: "The guide could not be opened. Refresh the page and try again.",
    empty: {
      overview: { title: "Start with a project", content: "Each project keeps its requirements, models, tests, and documents together across the development process." },
      create: { title: "Create your first project", content: "Open the form here, name and describe your project, then choose who can see it. You will enter its workspace after creating it." },
    },
  },
} as const;
