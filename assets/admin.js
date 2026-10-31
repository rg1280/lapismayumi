// 店主用の予約管理アプリ
(function () {
  const C = LM.CONFIG, S = LM.slots;
  const $ = (id) => document.getElementById(id);
  const WD = ["日", "月", "火", "水", "木", "金", "土"];
  const KEY = "lm_admin_key";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get: () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } },
                  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) { /* 保存できなくても動かす */ } } };

  let key = store.get();
  let data = null;

  // 店主の端末で新しい版が動いているかを確かめるための表示（直したら上げる）
  if ($("ver")) $("ver").textContent = "画面の版：10/31-3";
  if (LM.isDemo) { $("demoBar").classList.remove("hidden"); $("resetDemo").classList.remove("hidden"); }

  // ---------- 共通 ----------
  const dayKeyOf = (ms) => { const p = S.parts(ms); return S.keyOf(p.y, p.m, p.d); };
  const timeOf = (ms) => S.hhmm(S.parts(ms).min);
  const hhmm2 = (ms) => { const m = S.parts(ms).min; return `${S.pad(Math.floor(m / 60))}:${S.pad(m % 60)}`; };
  function fmtDay(key) { const { y, m, d } = S.fromKey(key); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return `${m}月${d}日（${WD[wd]}）`; }
  function fmtWhen(r) {
    if (!r.start) return "日時未定";
    return `${fmtDay(dayKeyOf(r.start))} ${timeOf(r.start)}〜${timeOf(r.start + r.minutes * 60000)}`;
  }
  const tagOf = (st) => ({ 仮予約: "kari", 確定: "kaku", キャンセル: "cancel", 日時相談: "soudan" }[st] || "kari");
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
  async function api(action, p) { return LM.api(action, Object.assign({ key }, p || {})); }

  // ---------- ログイン ----------
  async function start() {
    if (!key) { showLogin(); return; }
    try { await refresh(); showApp(); } catch (e) {
      if (/合言葉/.test(e.message)) { store.set(""); key = ""; showLogin(e.message); } else { toast(e.message); showApp(); }
    }
  }
  function showLogin(msg) {
    $("login").classList.remove("hidden"); $("app").classList.add("hidden"); $("tabbar").classList.add("hidden");
    $("loginErr").classList.toggle("hidden", !msg); $("loginErr").textContent = msg || "";
  }
  function showApp() { $("login").classList.add("hidden"); $("app").classList.remove("hidden"); $("tabbar").classList.remove("hidden"); }
  $("loginBtn").onclick = async () => {
    key = $("key").value.trim();
    try { await api("login"); store.set(key); start(); } catch (e) { showLogin(e.message); }
  };
  $("key").addEventListener("keydown", (e) => { if (e.key === "Enter") $("loginBtn").click(); });
  $("logout").onclick = () => { store.set(""); key = ""; showLogin(); };
  $("resetDemo").onclick = async () => { LM.resetDemo(); await refresh(); toast("見本データを最初に戻しました"); };
  $("reload").onclick = async () => { await refresh(); toast("最新にしました"); };

  async function refresh() {
    data = await api("list");
    renderTodo(); renderSchedule(); renderSettings();
  }

  // ---------- タブ ----------
  $("tabbar").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    document.querySelectorAll("#tabbar button").forEach((x) => x.classList.toggle("on", x === b));
    ["tabTodo", "tabList", "tabAdd", "tabSet"].forEach((id) => $(id).classList.toggle("hidden", id !== b.dataset.tab));
    window.scrollTo(0, 0);
  });

  // ---------- 要対応 ----------
  function detailHtml(r) {
    const rows = [];
    if (r.wishDate) rows.push(`ご希望：<b>${esc(r.wishDate)}</b>`);
    rows.push(`電話：<a href="tel:${esc(r.tel)}">${esc(r.tel)}</a>`);
    if (r.lineName) rows.push(`LINE名：<b>${esc(r.lineName)}</b>`);
    if (r.source) rows.push(`きっかけ：${esc(r.source)}`);
    if (r.area) rows.push(`お住まい：${esc(r.area)}`);
    if (r.concern) rows.push(`気になる箇所：<b>${esc(r.concern)}</b>`);
    if (r.channel === "Web") rows.push(`初めて：${r.first ? "はい" : "いいえ"}${r.first ? `／撮影協力：${esc(r.photo)}` : ""}`);
    if (r.memo) rows.push(`メモ：${esc(r.memo)}`);
    return rows.join("<br>");
  }
  function renderTodo() {
    const list = data.reservations.filter((r) => r.status === "仮予約" || r.status === "日時相談")
      .sort((a, b) => (a.start || 9e15) - (b.start || 9e15));
    $("badge").textContent = list.length;
    $("badge").classList.toggle("hidden", !list.length);
    $("todoList").innerHTML = list.length ? list.map((r) => `
      <div class="rcard">
        <div><span class="tag ${tagOf(r.status)}">${r.status}</span><span class="tag web">${esc(r.channel)}</span>${lineTag(r)}</div>
        ${r.channel === "Web" && !r.lineAt ? `<div class="line-wait">お客様から公式LINEへの予約番号（${esc(r.id)}）がまだ届いていません。届くまでは、こちらからLINEを送れません。電話で確かめるか、届くのを待ってください。</div>` : ""}
        <div class="when">${fmtWhen(r)}　${r.minutes}分</div>
        <div class="who">${esc(r.name)}${r.kana ? `（${esc(r.kana)}）` : ""} 様</div>
        <div class="meta">${detailHtml(r)}</div>
        <div class="acts">
          ${r.start ? `<button type="button" class="go" data-act="confirm" data-id="${r.id}">確定する</button>` : ""}
          <button type="button" data-act="edit" data-id="${r.id}">${r.start ? "変更" : "日時を決める"}</button>
          <button type="button" data-act="cancel" data-id="${r.id}">お断り</button>
          ${r.channel === "Web" && !r.lineAt ? `<button type="button" data-act="lineok" data-id="${r.id}">LINEが届いた</button>` : ""}
        </div>
      </div>`).join("") : `<div class="empty">対応待ちの申し込みはありません</div>`;
  }
  $("todoList").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const r = data.reservations.find((x) => x.id === b.dataset.id);
    if (b.dataset.act === "confirm") openConfirm(r);
    if (b.dataset.act === "edit") openEdit(r);
    if (b.dataset.act === "cancel") cancelRes(r);
    if (b.dataset.act === "lineok") save(Object.assign({}, r, { lineAt: "受信（手入力）" }), true);
  });
  // Webの申し込みは、お客様が公式LINEへ予約番号を送ってくれて初めて、店主から返信できる
  function lineTag(r) {
    if (r.channel !== "Web") return "";
    return r.lineAt ? `<span class="tag kaku">LINE受信済み</span>` : `<span class="tag soudan">LINE未着</span>`;
  }

  async function cancelRes(r) {
    if (!confirm(`${r.name} 様の${r.status === "確定" ? "予約をキャンセル" : "申し込みをお断り"}にしますか？\n（その時間は再び予約できるようになります）`)) return;
    await save(Object.assign({}, r, { status: "キャンセル" }), true);
    closeSheet();
  }

  // 確定：LINEで送る文面を作ってコピー
  function confirmText(r, place) {
    const c = C.COURSES.find((x) => x.minutes === r.minutes);
    return `${r.name} 様\n\nこの度は${C.SALON_NAME}へご予約のお申込みをいただき、有難うございます。\n以下の内容でご予約が確定いたしました。\n\n日時：${fmtWhen(r)}\nコース：${c ? c.label : r.minutes + "分"}\n\n【施術場所】\n${place || "（場所を入れてください）"}\n\nキャンセルやご変更の際は、お早めにご連絡ください。\n当日お会いできるのを楽しみにしております。`;
  }
  function openConfirm(r) {
    openSheet(`<h3>予約を確定する</h3>
      ${r.channel === "Web" && !r.lineAt ? `<div class="line-wait">まだこのお客様から公式LINEへ予約番号が届いていないため、LINEのトークが見つかりません。届いてから確定するのがおすすめです。</div>` : ""}
      <div class="meta" style="font-size:14px">${fmtWhen(r)}　${r.minutes}分<br>${esc(r.name)} 様${r.lineName ? `（LINE名：${esc(r.lineName)}）` : ""}</div>
      <div class="field" style="margin-top:12px"><label for="cPlace">施術場所</label><textarea id="cPlace" rows="8">${esc(r.place || data.settings.place || C.DEFAULT_PLACE || "")}</textarea></div>
      <span class="lbl" style="font-weight:600">LINEで送る文面</span>
      <div class="msgbox" id="cMsg"></div>
      <button class="btn btn-main" id="cGo" type="button">文面をコピーして確定にする</button>
      <button class="btn btn-ghost" id="cClose" type="button">やめる</button>
      <p class="note">確定にすると、Googleカレンダー（Life Bear）の「【仮】」が外れます。コピーした文面は公式LINEの${esc(r.lineName || r.name)}様とのトークに貼り付けて送ってください。</p>`);
    const upd = () => { $("cMsg").textContent = confirmText(r, $("cPlace").value.trim()); };
    $("cPlace").oninput = upd; upd();
    $("cClose").onclick = closeSheet;
    $("cGo").onclick = async () => {
      const text = $("cMsg").textContent;
      try { await navigator.clipboard.writeText(text); } catch (e) { /* コピーできない端末は下で知らせる */ }
      const ok = await save(Object.assign({}, r, { status: "確定", place: $("cPlace").value.trim() }));
      if (ok) { closeSheet(); toast("確定にしました。文面をコピーしたのでLINEに貼り付けてください"); }
    };
  }

  // ---------- 予約の入力（追加・変更で共通） ----------
  function resFormHtml(r, idp) {
    const opt = (list, v) => list.map((x) => `<option ${String(x) === String(v) ? "selected" : ""}>${x}</option>`).join("");
    const web = r.channel === "Web" ? `<div class="summary" style="font-size:13px;font-weight:400">${detailHtml(r)}</div>` : "";
    return `${web}
      <div class="two">
        <div class="field"><label for="${idp}St">状態</label><select id="${idp}St">${opt(["確定", "仮予約", "日時相談", "キャンセル"], r.status || "確定")}</select></div>
        <div class="field"><label for="${idp}Ch">受付</label><select id="${idp}Ch">${opt(["LINE", "Web", "電話・その他"], r.channel || "LINE")}</select></div>
      </div>
      <div class="two">
        <div class="field"><label for="${idp}Day">日にち</label><input type="date" id="${idp}Day" value="${r.start ? dayKeyOf(r.start) : ""}"></div>
        <div class="field"><label for="${idp}Tm">開始</label><input type="time" id="${idp}Tm" step="1800" value="${r.start ? hhmm2(r.start) : ""}"></div>
      </div>
      <div class="field"><label for="${idp}Min">コース</label><select id="${idp}Min">${C.COURSES.map((c) => `<option value="${c.minutes}" ${c.minutes === (r.minutes || C.DEFAULT_COURSE) ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
      <div class="two">
        <div class="field"><label for="${idp}Nm">お名前</label><input type="text" id="${idp}Nm" value="${esc(r.name)}"></div>
        <div class="field"><label for="${idp}Kn">ふりがな</label><input type="text" id="${idp}Kn" value="${esc(r.kana)}"></div>
      </div>
      <div class="two">
        <div class="field"><label for="${idp}Tel">電話</label><input type="tel" id="${idp}Tel" value="${esc(r.tel)}"></div>
        <div class="field"><label for="${idp}Ln">LINE名</label><input type="text" id="${idp}Ln" value="${esc(r.lineName)}"></div>
      </div>
      <div class="field"><label for="${idp}Pl">施術場所</label><textarea id="${idp}Pl" rows="3">${esc(r.place)}</textarea></div>
      <div class="field"><label for="${idp}Mm">メモ</label><textarea id="${idp}Mm">${esc(r.memo)}</textarea></div>`;
  }
  function readRes(r, idp) {
    const day = $(idp + "Day").value, tm = $(idp + "Tm").value;
    let start = null;
    if (day && tm) { const { y, m, d } = S.fromKey(day); start = S.msOf(y, m, d, S.toMin(tm)); }
    return Object.assign({}, r, {
      status: $(idp + "St").value, channel: $(idp + "Ch").value, start, minutes: Number($(idp + "Min").value),
      name: $(idp + "Nm").value.trim(), kana: $(idp + "Kn").value.trim(), tel: $(idp + "Tel").value.trim(),
      lineName: $(idp + "Ln").value.trim(), place: $(idp + "Pl").value.trim(), memo: $(idp + "Mm").value.trim(),
    });
  }
  async function save(item, force) {
    if ((item.status === "確定" || item.status === "仮予約") && !item.start) { toast("日にちと開始時刻を入れてください"); return false; }
    if (!item.name) { toast("お名前を入れてください"); return false; }
    // 重なりは手元の一覧で先に確かめる（裏側と同じ判定）。裏側の返事（5秒ほど）を待たずに画面へ反映する
    if (!force && item.start && (item.status === "確定" || item.status === "仮予約")) {
      const busy = data.reservations.filter((x) => x.id !== item.id && x.start && (x.status === "確定" || x.status === "仮予約"))
        .map((x) => [x.start, x.start + x.minutes * 60000])
        .concat(data.blocks.filter((b) => !b.allDay).map((b) => [b.start, b.end]));
      if (!S.isAvailable(dayKeyOf(item.start), S.parts(item.start).min, item.minutes, { now: 0, busy, closed: [] })) {
        if (!confirm("前後の予約・予定と重なっています（間を1時間空ける決まり）。\nそれでも入れますか？")) return false;
        force = true;
      }
    }
    const before = data.reservations;
    const tmp = Object.assign({}, item, { id: item.id || "保存中" + Date.now() });
    data.reservations = before.filter((x) => x.id !== item.id).concat([tmp]);
    renderTodo(); renderSchedule();
    sendSave(item, force, before);
    return true;
  }
  async function sendSave(item, force, before) {
    let res;
    try { res = await api("save", { item, force: !!force }); } catch (e) { res = { ok: false, error: e.message, conflict: /重な/.test(e.message) }; }
    if (!res.ok && res.conflict && confirm(res.error + "\nそれでも入れますか？")) return sendSave(item, true, before);
    if (!res.ok) { data.reservations = before; renderTodo(); renderSchedule(); toast("保存できませんでした：" + res.error); return; }
    refresh().catch(() => {});
  }

  // 追加タブ
  function renderAddForm() {
    $("resForm").innerHTML = resFormHtml({ status: "確定", channel: "LINE" }, "a") + `<button class="btn btn-main" type="submit">予約を入れる</button>`;
  }
  $("resForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await save(readRes({}, "a"))) { renderAddForm(); toast("予約を入れました"); }
  });
  $("addSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#addSeg button").forEach((x) => x.classList.toggle("on", x === b));
    $("resForm").classList.toggle("hidden", b.dataset.k !== "res");
    $("blockForm").classList.toggle("hidden", b.dataset.k !== "block");
  });
  $("bAll").onchange = () => $("bTimes").classList.toggle("hidden", $("bAll").checked);
  $("blockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const day = $("bDay").value;
    if (!day) { toast("日にちを入れてください"); return; }
    const { y, m, d } = S.fromKey(day);
    const item = { day, allDay: $("bAll").checked, title: $("bTitle").value.trim() || ($("bAll").checked ? "お休み" : "予定") };
    if (!item.allDay) {
      item.start = S.msOf(y, m, d, S.toMin($("bStart").value || "10:00"));
      item.end = S.msOf(y, m, d, S.toMin($("bEnd").value || "10:00"));
      if (item.end <= item.start) { toast("終了は開始より後にしてください"); return; }
    }
    // 予約と同じく、裏側の返事を待たずに先に画面へ出す
    const before = data.blocks;
    data.blocks = before.concat([Object.assign({ id: "保存中" + Date.now() }, item)]);
    renderSchedule(); toast("ふさぎました"); $("blockForm").reset(); $("bTimes").classList.remove("hidden");
    try { await api("block", { item }); refresh().catch(() => {}); }
    catch (err) { data.blocks = before; renderSchedule(); toast("ふさげませんでした：" + err.message); }
  });

  // 変更（下から出る画面）
  function openEdit(r) {
    openSheet(`<h3>予約の変更</h3>${resFormHtml(r, "e")}
      <button class="btn btn-main" id="eSave" type="button">保存する</button>
      ${r.status !== "キャンセル" ? `<button class="btn btn-ghost" id="eCancel" type="button">キャンセルにする</button>` : ""}
      <button class="btn btn-ghost" id="eClose" type="button">閉じる</button>`);
    $("eSave").onclick = async () => { if (await save(readRes(r, "e"))) { closeSheet(); toast("保存しました"); } };
    if ($("eCancel")) $("eCancel").onclick = () => cancelRes(r);
    $("eClose").onclick = closeSheet;
  }
  function openBlock(b) {
    openSheet(`<h3>ふさいだ時間</h3>
      <p>${fmtDay(b.day || dayKeyOf(b.start))} ${b.allDay ? "終日" : `${timeOf(b.start)}〜${timeOf(b.end)}`}<br>${esc(b.title)}</p>
      ${b.external ? `<p class="note">Googleカレンダー（Life Bear）の予定です。消すときはLife Bearから消してください。</p>` :
        `<button class="btn btn-main" id="bDel" type="button">ふさぎを解除する</button>`}
      <button class="btn btn-ghost" id="bClose" type="button">閉じる</button>`);
    // 裏側の返事（2回のやりとりで5秒ほど）を待たずに、先に画面から消す。失敗したら元に戻して知らせる
    if ($("bDel")) $("bDel").onclick = async () => {
      const before = data.blocks;
      data.blocks = before.filter((x) => x !== b);
      renderSchedule(); closeSheet(); toast("解除しました");
      try { await api("unblock", { id: b.id }); refresh().catch(() => {}); }
      catch (err) { data.blocks = before; renderSchedule(); toast("解除できませんでした：" + err.message); }
    };
    $("bClose").onclick = closeSheet;
  }
  function openSheet(html) { $("sheet").innerHTML = html; $("sheetBg").classList.remove("hidden"); document.body.style.overflow = "hidden"; }
  function closeSheet() { $("sheetBg").classList.add("hidden"); document.body.style.overflow = ""; }
  $("sheetBg").addEventListener("click", (e) => { if (e.target === $("sheetBg")) closeSheet(); });

  // ---------- 予定表 ----------
  function renderSchedule() {
    const past = $("showPast").checked;
    const todayKey = dayKeyOf(data.now);
    const items = [];
    data.reservations.forEach((r) => {
      if (!r.start) return;
      if (!past && (r.status === "キャンセル" || dayKeyOf(r.start) < todayKey)) return;
      items.push({ kind: "r", day: dayKeyOf(r.start), sort: r.start, r });
    });
    data.blocks.forEach((b) => {
      const day = b.day || dayKeyOf(b.start);
      if (!past && day < todayKey) return;
      items.push({ kind: "b", day, sort: b.allDay ? S.msOf(...Object.values(S.fromKey(day)), 0) : b.start, b });
    });
    items.sort((a, b) => a.sort - b.sort);
    if (!items.length) { $("schedule").innerHTML = `<div class="empty">予定はありません</div>`; return; }
    let html = "", cur = "";
    items.forEach((it) => {
      if (it.day !== cur) {
        cur = it.day;
        const { y, m, d } = S.fromKey(cur); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const hol = (data.holidays || []).indexOf(cur) >= 0;
        html += `<div class="day-h ${hol || wd === 0 ? "sun" : wd === 6 ? "sat" : ""}">${fmtDay(cur)}${hol ? " 祝" : ""}${cur === todayKey ? "　今日" : ""}</div>`;
      }
      if (it.kind === "r") {
        const r = it.r;
        html += `<div class="row ${r.status === "キャンセル" ? "dim" : ""}" data-r="${r.id}"><div class="t">${timeOf(r.start)}〜${timeOf(r.start + r.minutes * 60000)}</div>
          <div class="d"><span class="tag ${tagOf(r.status)}">${r.status}</span>${esc(r.name)} 様　${r.minutes}分</div></div>`;
      } else {
        const b = it.b;
        html += `<div class="row" data-b="${esc(b.id)}"><div class="t">${b.allDay ? "終日" : `${timeOf(b.start)}〜${timeOf(b.end)}`}</div>
          <div class="d"><span class="tag block">${b.external ? "カレンダー" : "ふさぎ"}</span>${esc(b.title)}</div></div>`;
      }
    });
    $("schedule").innerHTML = html;
  }
  $("showPast").onchange = renderSchedule;
  $("schedule").addEventListener("click", (e) => {
    const row = e.target.closest(".row"); if (!row) return;
    if (/^保存中/.test(row.dataset.r || row.dataset.b || "")) { toast("保存しています。数秒お待ちください"); return; }
    if (row.dataset.r) openEdit(data.reservations.find((x) => x.id === row.dataset.r));
    if (row.dataset.b) openBlock(data.blocks.find((x) => String(x.id) === row.dataset.b));
  });

  // ---------- 設定 ----------
  function renderSettings() {
    const s = data.settings;
    $("sWd").innerHTML = WD.map((w, i) => `<label><input type="checkbox" value="${i}" ${s.closedWeekdays.indexOf(i) >= 0 ? "checked" : ""}>${w}</label>`).join("");
    $("sPlace").value = s.place || C.DEFAULT_PLACE || "";
    $("sOwnCal").checked = !!s.useOwnerCalendar;
  }
  $("saveSet").onclick = async () => {
    const settings = {
      closedWeekdays: [...document.querySelectorAll("#sWd input:checked")].map((x) => Number(x.value)),
      place: $("sPlace").value.trim(), useOwnerCalendar: $("sOwnCal").checked,
    };
    try { await api("settings", { settings }); await refresh(); toast("保存しました"); } catch (e) { toast(e.message); }
  };

  renderAddForm();
  start();
})();
