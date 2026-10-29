// 空き判定。時刻はすべて日本時間で扱う。
// ⚠ 同じ判定を gas/Code.gs の isAvailable() にも書いている。片方を直したらもう片方も直す。
(function () {
  const C = LM.CONFIG;
  const JST = 9 * 3600 * 1000;
  const MIN = 60 * 1000;

  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const pad = (n) => String(n).padStart(2, "0");

  // ミリ秒 → 日本時間の年月日など
  function parts(ms) {
    const d = new Date(ms + JST);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(),
             min: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  // 日本時間の年月日＋分 → ミリ秒
  const msOf = (y, m, d, min) => Date.UTC(y, m - 1, d, 0, min) - JST;
  const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  function fromKey(key) { const [y, m, d] = key.split("-").map(Number); return { y, m, d }; }
  const hhmm = (min) => `${Math.floor(min / 60)}:${pad(min % 60)}`;

  // 今日から HORIZON_MONTHS か月先（同じ日）までの日付
  function days(nowMs) {
    const t = parts(nowMs);
    const end = new Date(Date.UTC(t.y, t.m - 1 + C.HORIZON_MONTHS, t.d));
    const out = [];
    for (let i = 0; ; i++) {
      const d = new Date(Date.UTC(t.y, t.m - 1, t.d + i));
      if (d > end) break;
      out.push({ key: keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
                 y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() });
    }
    return out;
  }

  function times() {
    const out = [];
    for (let t = toMin(C.OPEN); t <= toMin(C.LAST_START); t += C.STEP_MIN) out.push(t);
    return out;
  }

  // busy: [[開始ms, 終了ms], ...]  closed: 休みの日の "YYYY-MM-DD" の配列
  function isAvailable(dayKey, startMin, minutes, ctx) {
    if (ctx.closed && ctx.closed.indexOf(dayKey) >= 0) return false;
    const { y, m, d } = fromKey(dayKey);
    const s = msOf(y, m, d, startMin);
    const e = s + minutes * MIN;
    if (s < ctx.now + C.LEAD_HOURS * 60 * MIN) return false;
    const buf = C.BUFFER_MIN * MIN;
    for (const [bs, be] of ctx.busy) {
      if (s < be + buf && bs < e + buf) return false;
    }
    return true;
  }

  LM.slots = { parts, msOf, keyOf, fromKey, hhmm, toMin, days, times, isAvailable, pad };
})();
