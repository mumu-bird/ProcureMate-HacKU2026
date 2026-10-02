import { monitor } from "../lib/engine";
console.log("ProcureMate 库存监控已启动；每 60 秒检查，Ctrl+C 停止。");
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await monitor();
    console.log(new Date().toISOString(), JSON.stringify(result));
  } catch (e) {
    console.error(e instanceof Error ? e.message : "监控失败");
  } finally {
    running = false;
  }
}
await tick();
setInterval(tick, 60_000);
