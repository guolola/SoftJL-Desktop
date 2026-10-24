// Checks real wheel scrolling through the complete desktop shell and onboarding wrappers.
import assert from "node:assert/strict";

export async function verifyQuickModelingScroll(page, projectId) {
  const projectPath = `/projects/${encodeURIComponent(projectId)}`;
  const stateUrl = new URL(`/api${projectPath}/standard`, page.url()).href;
  const snapshot = await page.evaluate(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Quick-modeling state request failed: ${response.status}`);
    return response.json();
  }, stateUrl);
  // Supply long saved history without changing the persisted project or calling a provider.
  snapshot.state.conversation = Array.from({ length: 30 }, (_, index) => ({
    id: `scroll-message-${index}`,
    role: index % 2 ? "assistant" : "user",
    text: `Message ${index}: describe the modeling requirements. `.repeat(15),
    status: "completed",
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
  const serveHistory = route => route.fulfill({ json: snapshot });
  const originalSize = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await page.route(stateUrl, serveHistory);
  try {
    await page.goto(new URL(projectPath, page.url()).href);
    const viewport = page.getByTestId("conversation-message-viewport");
    await viewport.waitFor();
    // Wait for history initialization to finish before applying user scroll gestures.
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="conversation-message-viewport"]');
      return element && element.scrollTop > 0;
    });
    for (const size of [originalSize, { width: 960, height: 640 }]) {
      await page.setViewportSize(size);
      await viewport.evaluate(async element => {
        element.scrollTop = 0;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const bounds = await viewport.boundingBox();
      assert.ok(bounds && bounds.height > 0 && bounds.height < size.height,
        "The message viewport must stay within the desktop window");
      const footer = page.getByTestId("conversation-composer-footer");
      const footerBefore = await footer.boundingBox();
      assert.ok(footerBefore && footerBefore.y + footerBefore.height <= size.height + 1,
        "The composer must remain visible below the scrollable messages");
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.wheel(0, 360);
      await page.waitForFunction(() => {
        const element = document.querySelector('[data-testid="conversation-message-viewport"]');
        return element && element.scrollTop > 100 && element.scrollTop < 500;
      });
      const afterDown = await viewport.evaluate(element => element.scrollTop);
      await page.mouse.wheel(0, -240);
      await page.waitForFunction(previous => {
        const element = document.querySelector('[data-testid="conversation-message-viewport"]');
        return element && element.scrollTop < previous - 100;
      }, afterDown);
      const footerAfter = await footer.boundingBox();
      assert.equal(footerAfter?.y, footerBefore.y, "Scrolling messages must keep the composer in place");
      assert.ok(await page.locator(".desktop-workspace").evaluate(element =>
        element.scrollHeight <= element.clientHeight + 1 && element.scrollTop === 0),
      "Chat history must scroll inside its viewport instead of stretching the desktop workspace");
    }

    // Feed output through the running-state poll, exercising the actual viewport
    // resize observer and wheel events without calling a model or saving history.
    snapshot.state.run = { id: "scroll-stream", operation: "chat", status: "running", startedAt: new Date().toISOString() };
    const reply = { id: "scroll-stream-reply", role: "assistant", text: "Stream start. ".repeat(150), status: "streaming", createdAt: "2026-01-01T00:01:01.000Z" };
    snapshot.state.conversation.push({ id: "scroll-stream-user", role: "user", text: "Continue the response.", status: "completed", createdAt: "2026-01-01T00:01:00.000Z" }, reply);
    await page.reload();
    await page.getByText("Stream start.", { exact: false }).last().waitFor();
    const atBottom = () => page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="conversation-message-viewport"]');
      return element && Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) <= 2;
    });
    const append = async marker => {
      reply.text += `\n\n${marker} ` + "More streamed content. ".repeat(200);
      await page.getByText(marker, { exact: false }).last().waitFor();
    };
    await atBottom();
    await append("STREAM_FOLLOW");
    await atBottom();
    const bounds = await viewport.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, -420);
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="conversation-message-viewport"]');
      return element && element.scrollHeight - element.clientHeight - element.scrollTop > 200;
    });
    // Wait until the native wheel gesture settles before measuring the reader's position.
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="conversation-message-viewport"]');
      const previous = element.dataset.scrollProbe;
      element.dataset.scrollProbe = String(element.scrollTop);
      return previous === String(element.scrollTop);
    }, undefined, { polling: 100 });
    const pausedTop = await viewport.evaluate(element => element.scrollTop);
    await append("STREAM_PAUSED");
    assert.ok(Math.abs(await viewport.evaluate(element => element.scrollTop) - pausedTop) <= 2,
      "Streamed output must not pull the reader down after scrolling up");
    await page.mouse.wheel(0, 100000);
    await atBottom();
    await append("STREAM_RESUMED");
    await atBottom();
    // The existing jump-to-latest control must also re-enable following.
    await page.mouse.wheel(0, -420);
    await page.getByRole("button", { name: "滚动到底部", exact: true }).click();
    await atBottom();
    await append("STREAM_BUTTON_RESUMED");
    await atBottom();
  } finally {
    await page.unroute(stateUrl, serveHistory);
    await page.setViewportSize(originalSize);
  }
}
