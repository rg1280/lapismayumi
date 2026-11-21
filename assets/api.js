// 裏側（Apps Script）との通信。API_URL が空なら端末の中の見本データで動く。
(function () {
  const C = LM.CONFIG;

  async function call(action, payload) {
    if (!C.API_URL) return mock(action, payload || {});
    // text/plain で送ると、ブラウザの事前確認（CORS）が要らない
    const res = await fetch(C.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ action }, payload || {})),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "通信に失敗しました");
    return j;
  }

  // ---------- 見本モード ----------
  const S = LM.slots;
  const DB_KEY = "lm_demo_db_v1";
  const DEMO_KEY = "demo";
  const HOLIDAYS = ["2026-11-03", "2026-11-23", "2027-01-01", "2027-01-11", "2027-02-11", "2027-02-23"];

  function load() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { /* 読めなければ作り直す */ }
    if (db) return db;
    const t = S.parts(Date.now());
    const at = (addDays, min) => S.msOf(t.y, t.m, t.d + addDays, min);
    let seq = 1;
    const r = (o) => Object.assign({ id: "R" + String(seq++).padStart(4, "0"), createdAt: Date.now(), kana: "", tel: "090-0000-0000",
      source: "Instagram", area: "愛知県大府市", concern: "", first: true, photo: "いいえ", lineName: "", channel: "Web",
      place: "", memo: "", wishDate: "" }, o);
    db = {
      reservations: [
        r({ status: "確定", start: at(1, 15 * 60), minutes: 90, name: "見本 花子", kana: "みほん はなこ", concern: "肩こり" }),
        r({ status: "仮予約", start: at(2, 10 * 60), minutes: 120, name: "見本 太郎", kana: "みほん たろう", concern: "腰" }),
        r({ status: "確定", start: at(3, 13 * 60), minutes: 60, name: "見本 次郎", channel: "LINE", first: false, photo: "" }),
      ],
      blocks: [{ id: "B1", title: "私用", start: at(1, 10 * 60), end: at(1, 12 * 60) }],
      settings: { closedWeekdays: [], place: LM.CONFIG.DEFAULT_PLACE || "", useOwnerCalendar: true },
    };
    save(db);
    return db;
  }
  function save(db) { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* 保存できない端末でも画面は動かす */ } }

  function busyOf(db, exceptId) {
    const busy = db.reservations
      .filter((r) => r.start && (r.status === "仮予約" || r.status === "確定") && r.id !== exceptId)
      .map((r) => [r.start, r.start + r.minutes * 60000]);
    db.blocks.filter((b) => !b.allDay).forEach((b) => busy.push([b.start, b.end, 1]));
    return busy;
  }
  function closedOf(db) {
    const out = [];
    S.days(Date.now()).forEach((d) => { if (db.settings.closedWeekdays.indexOf(d.wd) >= 0) out.push(d.key); });
    db.blocks.filter((b) => b.allDay).forEach((b) => out.push(b.day));
    return out;
  }
  function needKey(p) { if (p.key !== DEMO_KEY) throw new Error("合言葉が違います（見本は demo）"); }

  async function mock(action, p) {
    await new Promise((r) => setTimeout(r, 250));
    const db = load();
    if (action === "availability") {
      return { ok: true, now: Date.now(), busy: busyOf(db), closed: closedOf(db), holidays: HOLIDAYS };
    }
    if (action === "request") {
      if (p.start) {
        const t = S.parts(p.start);
        const ok = S.isAvailable(S.keyOf(t.y, t.m, t.d), t.min, p.minutes, { now: Date.now(), busy: busyOf(db), closed: closedOf(db) });
        if (!ok) throw new Error("申し訳ありません。その時間はたった今埋まりました。別の時間をお選びください。");
      }
      const id = "R" + String(db.reservations.length + 1).padStart(4, "0");
      db.reservations.push(Object.assign({}, p, { id, createdAt: Date.now(), status: p.start ? "仮予約" : "日時相談", channel: "Web", place: "", memo: "" }));
      save(db);
      return { ok: true, id };
    }
    needKey(p);
    if (action === "login") return { ok: true };
    if (action === "list") {
      const saleOf = {};
      (db.sales || []).forEach((s) => { if (s.resId && s.state !== "取消") saleOf[s.resId] = s.id; });
      return { ok: true, now: Date.now(), reservations: db.reservations, blocks: db.blocks, settings: db.settings,
               closed: closedOf(db), holidays: HOLIDAYS, saleOf };
    }
    if (action === "save") {
      const r = p.item;
      if (r.start && (r.status === "仮予約" || r.status === "確定") && !p.force) {
        const t = S.parts(r.start);
        const ok = S.isAvailable(S.keyOf(t.y, t.m, t.d), t.min, r.minutes, { now: 0, busy: busyOf(db, r.id), closed: [] });
        if (!ok) return { ok: false, conflict: true, error: "前後の予約・予定と重なっています（間を1時間空ける決まり）。" };
      }
      if (r.id) {
        const i = db.reservations.findIndex((x) => x.id === r.id);
        db.reservations[i] = Object.assign(db.reservations[i], r);
      } else {
        r.id = "R" + String(db.reservations.length + 1).padStart(4, "0");
        r.createdAt = Date.now();
        db.reservations.push(r);
      }
      save(db);
      return { ok: true, id: r.id };
    }
    if (action === "block") {
      db.blocks.push(Object.assign({ id: "B" + Date.now() }, p.item));
      save(db);
      return { ok: true };
    }
    if (action === "unblock") {
      db.blocks = db.blocks.filter((b) => b.id !== p.id);
      save(db);
      return { ok: true };
    }
    if (action === "settings") {
      db.settings = Object.assign(db.settings, p.settings);
      save(db);
      return { ok: true, settings: db.settings };
    }
    // ---------- 経理（見本。裏側は gas/経理.gs） ----------
    db.sales = db.sales || []; db.expenses = db.expenses || [];
    db.keiri = db.keiri || LM.keiriDefaults();
    if (action === "keiriList") {
      const y = String(p.year || S.parts(Date.now()).y);
      return { ok: true, year: Number(y), sales: db.sales.filter((r) => r.day.indexOf(y) === 0),
               expenses: db.expenses.filter((r) => r.day.indexOf(y) === 0), settings: db.keiri };
    }
    if (action === "saleSave" || action === "expenseSave") {
      const list = action === "saleSave" ? db.sales : db.expenses;
      const it = Object.assign({}, p.item, { state: "有効", updatedAt: Date.now() });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(it.day || "")) throw new Error("日付を入れてください");
      if (!(Number(it.amount) >= 0) || it.amount === "") throw new Error("金額を正しく入れてください");
      it.amount = Math.round(Number(it.amount));
      if (action === "saleSave" && !it.id && it.resId && list.some((x) => x.resId === it.resId && x.state !== "取消")) throw new Error("この予約の売上はもう記録されています");
      if (p.image && p.image.data) { it.imageUrl = "data:" + p.image.type + ";base64," + p.image.data.slice(0, 0) + "#見本"; it.imageId = "demo" + Date.now(); }
      if (it.id) { const i = list.findIndex((x) => x.id === it.id); if (!it.imageId) { it.imageUrl = list[i].imageUrl; it.imageId = list[i].imageId; } list[i] = Object.assign(list[i], it); }
      else { it.id = (action === "saleSave" ? "S" : "E") + String(list.length + 1).padStart(5, "0"); it.createdAt = Date.now(); list.push(it); }
      save(db);
      return { ok: true, id: it.id };
    }
    if (action === "keiriDelete") {
      const list = p.kind === "expense" ? db.expenses : db.sales;
      const r = list.find((x) => x.id === p.id); if (r) r.state = "取消";
      save(db);
      return { ok: true };
    }
    if (action === "keiriSettings") { db.keiri = Object.assign(db.keiri, p.settings); save(db); return { ok: true, settings: db.keiri }; }
    throw new Error("不明な操作です: " + action);
  }

  LM.api = call;
  LM.isDemo = !C.API_URL;
  LM.resetDemo = () => { try { localStorage.removeItem(DB_KEY); } catch (e) { /* なにもしない */ } };
})();
