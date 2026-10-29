// 予約申し込み画面
(function () {
  const C = LM.CONFIG, S = LM.slots;
  const $ = (id) => document.getElementById(id);
  const WD = ["日", "月", "火", "水", "木", "金", "土"];

  const state = { minutes: C.DEFAULT_COURSE, week: 0, data: null, pick: null, wishMode: false, line: null };

  if (LM.isDemo) $("demoBar").classList.remove("hidden");

  // ---------- コース ----------
  function renderCourses() {
    $("courses").innerHTML = C.COURSES.map((c) =>
      `<button type="button" data-min="${c.minutes}" class="${c.minutes === state.minutes ? "on" : ""}">
         <b>${c.minutes}<small>分</small></b>
         <span>${c.price ? "¥" + c.price.toLocaleString() : "コース"}</span></button>`).join("");
  }
  $("courses").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    state.minutes = Number(b.dataset.min);
    renderCourses();
    renderGrid();
  });

  // ---------- 日時の表 ----------
  async function loadAvailability() {
    $("grid").innerHTML = '<div class="loading">空き状況を読み込んでいます…</div>';
    try {
      state.data = await LM.api("availability");
      renderGrid();
    } catch (e) {
      $("grid").innerHTML = `<div class="loading">空き状況を読み込めませんでした。<br>時間をおいて開き直すか、公式LINEからご連絡ください。</div>`;
    }
  }

  function renderGrid() {
    const d = state.data;
    if (!d) return;
    const days = S.days(d.now);
    const pages = Math.ceil(days.length / 7);
    state.week = Math.max(0, Math.min(state.week, pages - 1));
    const cols = days.slice(state.week * 7, state.week * 7 + 7);
    while (cols.length < 7) cols.push(null);
    const hol = new Set(d.holidays || []);
    const ctx = { now: d.now, busy: d.busy, closed: d.closed };

    // 月の行（同じ月の列をまとめる）
    let monthRow = "<tr class='month'><th></th>";
    for (let i = 0; i < 7;) {
      const c = cols[i];
      let span = 1;
      while (i + span < 7 && cols[i + span] && c && cols[i + span].m === c.m) span++;
      monthRow += `<th colspan="${span}">${c ? `${c.y}年${c.m}月` : ""}</th>`;
      i += span;
    }
    monthRow += "</tr>";

    let dateRow = "<tr class='dates'><th></th>";
    const todayKey = days[0].key;
    cols.forEach((c) => {
      if (!c) { dateRow += "<th></th>"; return; }
      const isHol = hol.has(c.key);
      const cls = (isHol || c.wd === 0 ? "sun" : c.wd === 6 ? "sat" : "") + (c.key === todayKey ? " today" : "");
      dateRow += `<th class="${cls}"><b>${c.d}</b><span>${isHol ? "祝" : WD[c.wd]}</span></th>`;
    });
    dateRow += "</tr>";

    let body = "";
    S.times().forEach((t) => {
      body += `<tr><td class="time">${S.hhmm(t)}</td>`;
      cols.forEach((c) => {
        if (!c) { body += `<td class="s out">－</td>`; return; }
        body += S.isAvailable(c.key, t, state.minutes, ctx)
          ? `<td class="s"><button type="button" data-day="${c.key}" data-t="${t}" aria-label="${c.m}月${c.d}日 ${S.hhmm(t)} 予約可">${OK_ICON}</button></td>`
          : `<td class="s ng">${NG_ICON}</td>`;
      });
      body += "</tr>";
    });

    $("grid").innerHTML = `<table><colgroup><col class="tcol"><col span="7"></colgroup>
      <thead>${monthRow}${dateRow}</thead><tbody>${body}</tbody></table>`;

    const first = cols[0], last = cols.filter(Boolean).pop();
    $("range").textContent = `${first.m}.${first.d} — ${last.m}.${last.d}`;
    $("prevW").disabled = state.week === 0;
    $("nextW").disabled = state.week >= pages - 1;
    $("wishBtn").classList.toggle("last", state.week >= pages - 1);
  }
  const OK_ICON = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" fill="none" stroke="#2f2fb5" stroke-width="1.6"/><circle cx="11" cy="11" r="4.6" fill="none" stroke="#2f2fb5" stroke-width="1.6"/></svg>';
  const NG_ICON = '<svg role="img" aria-label="予約不可" width="12" height="12" viewBox="0 0 12 12"><path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" stroke="#9590b6" stroke-width="1.3" stroke-linecap="round"/></svg>';

  $("grid").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-day]");
    if (!b) return;
    const { y, m, d } = S.fromKey(b.dataset.day);
    state.pick = { key: b.dataset.day, t: Number(b.dataset.t), start: S.msOf(y, m, d, Number(b.dataset.t)) };
    state.wishMode = false;
    openForm();
  });
  $("prevW").onclick = () => goWeek(-1);
  $("nextW").onclick = () => goWeek(1);

  // 左右のスライドで週を切り替える（指・マウスのドラッグ・タッチパッドの横スクロール）
  // 表は指に合わせて動き、離すと次の週がすべり込む
  function goWeek(dir) {
    if (dir > 0 ? $("nextW").disabled : $("prevW").disabled) return false;
    state.week += dir;
    renderGrid();
    const g = $("grid");
    g.style.transition = "none";
    g.style.transform = `translateX(${dir * 40}%)`;
    g.style.opacity = "0";
    void g.offsetWidth; // ずらした位置を一度確定させてから、元の位置へ動かす
    g.style.transition = "transform .25s ease, opacity .25s ease";
    g.style.transform = ""; g.style.opacity = "";
    return true;
  }
  let drag = null, dragged = false;
  const grid = $("grid");
  grid.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId, horiz: false };
    dragged = false;
  });
  grid.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.horiz && Math.abs(drag.dx) > 8 && Math.abs(drag.dx) > Math.abs(dy)) {
      drag.horiz = true;
      try { grid.setPointerCapture(e.pointerId); } catch (err) { /* 取れなくても動かす */ }
    }
    if (drag.horiz) {
      dragged = true;
      grid.style.transition = "none";
      grid.style.transform = `translateX(${drag.dx * 0.6}px)`;
    }
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.horiz) return;
    if (Math.abs(d.dx) >= 50 && goWeek(d.dx < 0 ? 1 : -1)) return;
    grid.style.transition = "transform .2s ease";
    grid.style.transform = "";
  }
  grid.addEventListener("pointerup", endDrag);
  grid.addEventListener("pointercancel", endDrag);
  // ドラッグの最後に◎を押したことにしない
  grid.addEventListener("click", (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  // タッチパッドの横スクロール
  let wheelSum = 0, wheelLock = 0;
  $("cal").addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (Date.now() < wheelLock) return;
    wheelSum += e.deltaX;
    if (Math.abs(wheelSum) > 60) { goWeek(wheelSum > 0 ? 1 : -1); wheelSum = 0; wheelLock = Date.now() + 500; }
  }, { passive: false });

  $("wishBtn").onclick = () => { state.pick = null; state.wishMode = true; openForm(); };

  // ---------- 入力画面 ----------
  const fmtDay = (key) => { const { y, m, d } = S.fromKey(key); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return `${y}年${m}月${d}日（${WD[wd]}）`; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function whenText() {
    return state.pick ? `${fmtDay(state.pick.key)} ${S.hhmm(state.pick.t)}〜${S.hhmm(state.pick.t + state.minutes)}` : "下の欄にご記入ください";
  }
  const MOON = '<svg class="deco" aria-hidden="true" width="140" height="90" viewBox="0 0 140 90"><path d="M104 18a26 26 0 1 0 22 36a21 21 0 1 1 -22 -36z" fill="none" stroke="#fff" stroke-width="1.2"/><circle cx="70" cy="22" r="1.2" fill="#fff"/><circle cx="86" cy="62" r=".9" fill="#fff"/><circle cx="132" cy="14" r="1" fill="#fff"/></svg>';
  function summaryHtml() {
    const c = C.COURSES.find((x) => x.minutes === state.minutes);
    return MOON +
      `<div class="it"><small>コース</small><b>${c.label}${c.price ? `<span class="pr">¥${c.price.toLocaleString()}</span>` : ""}</b></div>` +
      `<div class="it"><small>ご希望の日時</small><b>${whenText()}</b></div>`;
  }
  function doneHtml(wish) {
    const c = C.COURSES.find((x) => x.minutes === state.minutes);
    return `<dt>コース</dt><dd>${c.label}</dd><dt>ご希望日時</dt><dd>${state.pick ? whenText() : esc(wish)}</dd>`;
  }
  const CHECK = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#12124f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const MOON_S = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="#fff" stroke-width="1.8"/></svg>';
  function showPage(n) {
    ["pagePick", "pageForm", "pageDone"].forEach((id, i) => $(id).classList.toggle("hidden", i !== n));
    document.querySelectorAll("#flow .st").forEach((st, i) => {
      st.classList.toggle("now", i === n);
      st.classList.toggle("done", i < n);
      st.querySelector(".dot").innerHTML = i === n ? MOON_S : i < n ? CHECK : String(i + 1);
    });
    document.querySelectorAll("#flow .bar").forEach((b, i) => b.classList.toggle("on", i < n));
    $("skyBig").classList.toggle("hidden", n !== 0);
    $("skySmall").classList.toggle("hidden", n === 0);
    document.body.classList.toggle("page-done", n === 2);
    window.scrollTo(0, 0);
  }
  function openForm() {
    $("summary").innerHTML = summaryHtml() + `<button type="button" id="chg">メニュー・日時を変更する</button>`;
    $("chg").onclick = backToPick;
    $("fWish").classList.toggle("hidden", !state.wishMode);
    showPage(1);
  }
  function backToPick() { showPage(0); loadAvailability(); }
  $("backBtn").onclick = backToPick;

  $("source").onchange = () => $("sourceOther").classList.toggle("hidden", $("source").value !== "その他");
  document.querySelectorAll("input[name=first]").forEach((r) => r.onchange = () =>
    $("fPhoto").classList.toggle("hidden", radio("first") !== "はい"));
  const radio = (name) => { const r = document.querySelector(`input[name=${name}]:checked`); return r ? r.value : ""; };

  function check() {
    document.querySelectorAll(".field.bad").forEach((f) => { f.classList.remove("bad"); const e = f.querySelector(".err"); if (e) e.remove(); });
    const bad = [];
    const need = (fid, ok, msg) => { if (!ok) { bad.push(fid); const f = $(fid); f.classList.add("bad"); f.insertAdjacentHTML("beforeend", `<div class="err">${msg}</div>`); } };
    if (state.wishMode) need("fWish", $("wish").value.trim(), "ご希望の日にち・時間をご記入ください");
    need("fName", $("name").value.trim(), "お名前をご記入ください");
    need("fKana", $("kana").value.trim(), "ふりがなをご記入ください");
    const tel = $("tel").value.replace(/[^\d]/g, "");
    need("fTel", tel.length >= 10 && tel.length <= 11, "電話番号をご確認ください（10〜11桁）");
    if (!state.line) need("fLine", $("lineName").value.trim(), "LINEのお名前をご記入ください");
    need("fSource", $("source").value, "選んでください");
    need("fArea", $("area").value.trim(), "お住まいをご記入ください");
    need("fFirst", radio("first"), "選んでください");
    if (radio("first") === "はい") need("fPhoto", radio("photo"), "選んでください");
    need("fAgree", $("agree").checked, "ご注意をご確認のうえ、チェックを入れてください");
    if (bad.length) $(bad[0]).scrollIntoView({ behavior: "smooth", block: "center" });
    return bad.length === 0;
  }

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!check()) return;
    const src = $("source").value === "その他" && $("sourceOther").value.trim() ? "その他：" + $("sourceOther").value.trim() : $("source").value;
    const payload = {
      minutes: state.minutes,
      start: state.pick ? state.pick.start : null,
      wishDate: state.wishMode ? $("wish").value.trim() : "",
      name: $("name").value.trim(), kana: $("kana").value.trim(), tel: $("tel").value.trim(),
      lineName: state.line ? state.line.displayName : $("lineName").value.trim(),
      lineUserId: state.line ? state.line.userId : "",
      source: src, area: $("area").value.trim(), concern: $("concern").value.trim(),
      first: radio("first") === "はい", photo: radio("first") === "はい" ? radio("photo") : "",
    };
    const btn = $("submitBtn");
    btn.disabled = true; $("submitTx").textContent = "送信しています…";
    try {
      const res = await LM.api("request", payload);
      $("doneSummary").innerHTML = doneHtml(payload.wishDate);
      showSend(res.id, payload);
      showPage(2);
    } catch (err) {
      toast(err.message);
      if (/埋まり/.test(err.message)) setTimeout(backToPick, 1800);
    } finally {
      btn.disabled = false; $("submitTx").textContent = SUBMIT_TX;
    }
  });
  const SUBMIT_TX = $("submitTx").textContent;

  // ---------- 最後：公式LINEへ予約番号を送ってもらう ----------
  // 公式LINEは、お客様から一度メッセージが来ないと店主から送れない。だから申し込みの最後にお客様から1通送ってもらう
  let sent = false;
  function showSend(id, p) {
    const c = C.COURSES.find((x) => x.minutes === p.minutes);
    const text = [`【Web予約】予約番号 ${id}`, `${p.name} 様`,
      `${state.pick ? whenText() : "ご希望：" + p.wishDate}`, `${c.label}`].join("\n");
    $("rno").textContent = id;
    $("sendText").textContent = text;
    const lineId = C.LINE_ID || "";
    $("sendLine").href = lineId ? `https://line.me/R/oaMessage/${encodeURIComponent(lineId)}/?${encodeURIComponent(text)}` : (C.LINE_URL || "#");
    $("addFriend").href = C.LINE_URL || "#";
    sent = false;
  }
  $("sendLine").addEventListener("click", () => { sent = true; });
  $("copyText").onclick = async () => {
    try { await navigator.clipboard.writeText($("sendText").textContent); toast("コピーしました。公式LINEのトークに貼り付けて送ってください"); }
    catch (e) { toast("コピーできませんでした。文章を長押ししてコピーしてください"); }
  };
  // LINEへ送る前にページを閉じようとしたら、引き止める
  window.addEventListener("beforeunload", (e) => {
    if ($("pageDone").classList.contains("hidden") || sent) return;
    e.preventDefault(); e.returnValue = "";
  });

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ---------- LINE（LIFF）で開いたとき ----------
  function initLiff() {
    if (!C.LIFF_ID) return;
    const s = document.createElement("script");
    s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    s.onload = async () => {
      try {
        await liff.init({ liffId: C.LIFF_ID });
        if (!liff.isLoggedIn()) { if (liff.isInClient()) liff.login(); return; }
        state.line = await liff.getProfile();
        $("fLine").classList.add("hidden");
      } catch (e) { /* LINEの名前が取れなくても、手入力で申し込める */ }
    };
    document.head.appendChild(s);
  }

  // 受付時間外の相談先。LINEの友だち追加URLが無ければ、リンクを外して文字だけにする
  if (C.LINE_URL) $("hoursLine").href = C.LINE_URL; else $("hoursLine").removeAttribute("href");

  renderCourses();
  showPage(0);
  loadAvailability();
  initLiff();
})();
