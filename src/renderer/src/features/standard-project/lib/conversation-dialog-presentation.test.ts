// Pins plugin copy translation to presentation while preserving authored content and grant scope.
import { expect, it } from "vitest";
import { pluginDialogText } from "./conversation-dialog-presentation.js";

it("translates directional and forwarded grants without changing target paths or names", () => {
  const target = '"E:/project/read path/skill.ts"';
  expect(pluginDialogText(`Yes, allow reads and writes to ${target} for this session`, true, true)).toBe(`本会话允许读写 ${target}`);
  expect(pluginDialogText("This subagent ('Explorer') only", true, true)).toBe("仅此子代理（Explorer）");
  expect(pluginDialogText(`The whole session — allow path ${target} for parent and all subagents`, true, true))
    .toBe(`整个会话：允许主代理和所有子代理使用 path ${target}`);
});

it("keeps authored choices and paths unchanged outside plugin permission chrome", () => {
  expect(pluginDialogText("Yes\nNo\nread path : E:/project/skill.ts", true)).toBe("Yes\nNo\nread path : E:/project/skill.ts");
  expect(pluginDialogText("4. Type something.", true)).toBe("4. 输入其他答案");
  const english = "Permission Required\nread path : E:/project/skill.ts";
  expect(pluginDialogText(english, false, true)).toBe(english);
});
