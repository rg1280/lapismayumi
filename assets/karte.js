// カルテ（施術のあとの記録）2026-11-25 作成。裏側は gas/カルテ.gs
// 入力欄は「施術完了（売上を記録）」の下に出る。全身図を押すと印が付き、印を押すと消える。
(function () {
  let A = null;          // admin.js から渡される道具
  let onSaved = () => {};
  const drafts = {};     // 保存する前に閉じたとき、同じ画面を開き直せば戻る（端末には残さない）
  const $ = (id) => document.getElementById(id);
  const md = (day) => { const p = day.split("-"); return `${Number(p[0])}年${Number(p[1])}月${Number(p[2])}日`; };

  // ---------- 全身図（左右対称。半身の点をつないで滑らかな線にする。座標は 160×390） ----------
  const HALF = [[9, 52], [10, 63], [20, 70], [34, 75], [42, 86], [45, 108], [49, 134], [54, 160], [58, 186], [62, 202], [61, 217], [56, 219], [53, 206], [51, 188],
    [45, 162], [39, 137], [33, 108], [31, 128], [28, 152], [31, 174], [36, 198], [36, 224], [33, 254], [28, 284], [29, 308], [25, 336], [20, 360], [25, 376], [14, 380], [8, 373],
    [9, 356], [9, 332], [9, 306], [9, 284], [6, 252], [2, 218]];
  const outline = (() => {
    const pts = HALF.map((p) => [80 + p[0], p[1]]).concat([[80, 210]], HALF.slice().reverse().map((p) => [80 - p[0], p[1]]));
    let d = `M${pts[0]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i - 1] || pts[i], b = pts[i], c = pts[i + 1], e = pts[i + 2] || c;
      const f = (v) => Math.round(v * 10) / 10;
      d += `C${f(b[0] + (c[0] - a[0]) / 7)},${f(b[1] + (c[1] - a[1]) / 7)} ${f(c[0] - (e[0] - b[0]) / 7)},${f(c[1] - (e[1] - b[1]) / 7)} ${c}`;
    }
    return d + "Z";
  })();
  const LINES = {
    f: "M52 82Q66 78 76 84M108 82Q94 78 84 84M56 118Q66 126 77 118M104 118Q94 126 83 118M80 124V150M79 166h2M60 198Q70 212 80 212Q90 212 100 198M56 284Q62 290 68 284M104 284Q98 290 92 284",
    b: "M80 66V186M58 92Q70 96 70 114Q64 124 56 116M102 92Q90 96 90 114Q96 124 104 116M54 176Q66 168 80 182Q94 168 106 176M80 186V210M50 218Q64 228 78 216M110 218Q96 228 82 216M56 286Q62 282 68 286M104 286Q98 282 92 286",
  };
  function figure(v, pins, old) {
    const dot = (p, cls, r) => `<circle class="${cls}" cx="${p.x}" cy="${p.y}" r="${r}"/>`;
    const of = (list) => (list || []).filter((p) => p.v === v);
    const side = v === "f" ? ["右", "左"] : ["左", "右"];
    return `<svg class="kt-fig" data-v="${v}" viewBox="0 0 160 402" role="img" aria-label="全身図（${v === "f" ? "前" : "後ろ"}）印${of(pins).length}か所">
      <rect class="kt-hit" width="160" height="402"/>
      <path class="kt-body" d="${outline}"/><ellipse class="kt-body" cx="80" cy="30" rx="18" ry="24"/>
      <path class="kt-line" d="${LINES[v]}"/>
      <text x="80" y="398" text-anchor="middle" class="kt-cap">${v === "f" ? "前" : "後ろ"}</text>
      <text x="10" y="14" class="kt-lr">${side[0]}</text><text x="150" y="14" text-anchor="end" class="kt-lr">${side[1]}</text>
      ${of(old).map((p) => dot(p, "kt-old", 5)).join("")}${of(pins).map((p) => dot(p, "kt-pin", 5)).join("")}</svg>`;
  }
  const figures = (pins, old) => `<div class="kt-figs">${figure("f", pins, old)}${figure("b", pins, old)}</div>`;

  // 過去のカルテ1件分
  function card(k) {
    const part = (t, v) => v ? `<dt>${t}</dt><dd>${A.esc(v)}</dd>` : "";
    return `<div class="kt-card"><dl>${part("施術内容・体の状態", k.treat)}${part("会話のメモ", k.talk)}${part("次回に活かすこと", k.next)}</dl>
      ${k.pins && k.pins.length ? figures(k.pins) : ""}</div>`;
  }
  const history = (list, openFirst) => list.map((k, i) => `<details class="kt-past" ${openFirst && i === 0 ? "open" : ""}><summary>${md(k.day)}${i === 0 ? "（前回）" : ""}</summary>${card(k)}</details>`).join("");

  // ---------- 入力欄（売上の画面の中） ----------
  // ctx: {resId, saleId, tel, day(), name()}。返り値の save(saleId) を、売上の保存のあとに呼ぶ
  function form(host, ctx) {
    const dkey = ctx.resId || ctx.saleId || "new";
    let cur = null, past = [], pins = [], ready = false, failed = false, seq = 0;
    const key = () => host.querySelector(".kt-figs-in");
    const val = () => ({ treat: $("ktTreat").value.trim(), talk: $("ktTalk").value.trim(), next: $("ktNext").value.trim(), pins });
    const sig = (v) => JSON.stringify([v.treat || "", v.talk || "", v.next || "", v.pins || []]);
    const keep = () => { drafts[dkey] = val(); };
    const showOld = () => past[0] && past[0].pins.length && $("ktOld") && $("ktOld").checked;
    const draw = () => { key().innerHTML = figures(pins, showOld() ? past[0].pins : []); $("ktCount").textContent = pins.length ? `${pins.length}か所` : "印なし"; };

    async function loadPast() {
      const my = ++seq, name = ctx.name();
      if (!name && !ctx.resId && !ctx.saleId) return { list: [], my };
      const res = await A.api("karteList", { name, tel: ctx.tel || "", resId: ctx.resId || "", saleId: ctx.saleId || "" });
      return { list: res.list, my };
    }
    const mine = (k) => (ctx.resId && k.resId === ctx.resId) || (ctx.saleId && k.saleId === ctx.saleId) || (cur && k.id === cur.id);
    function drawPast() {
      $("ktPast").innerHTML = past.length ? `<span class="lbl">これまでのカルテ（${past.length}件）</span>${history(past, false)}` : "";
      const has = past[0] && past[0].pins.length;
      $("ktOldBox").classList.toggle("hidden", !has);
      draw();
    }
    const setPast = (list) => { const today = ctx.day(); past = list.filter((k) => !mine(k) && k.day <= today); };

    host.innerHTML = `<p class="note">カルテを読み込んでいます…</p>`;
    loadPast().then(({ list }) => {
      if (!host.isConnected) return;
      cur = list.find(mine) || null;
      setPast(list);
      const v = drafts[dkey] || cur || { treat: "", talk: "", next: "", pins: [] };
      pins = (v.pins || []).slice();
      host.innerHTML = `
        <div id="ktPast"></div>
        <div class="kt-head"><span class="lbl">悪かった場所</span><b id="ktCount"></b></div>
        <p class="note" style="margin-top:0">図を押すと印が付きます。印を押すと消えます。</p>
        <div class="kt-figs-in"></div>
        <div class="kt-tools"><button type="button" id="ktUndo">ひとつ戻す</button><button type="button" id="ktClear">全部消す</button></div>
        <label class="agree kt-oldbox hidden" id="ktOldBox"><input type="checkbox" id="ktOld" checked>前回の印をうすく重ねる</label>
        <div class="field"><label for="ktTreat">施術内容・体の状態</label><textarea id="ktTreat" rows="3" placeholder="例）右肩を中心に。腰は前回より楽とのこと">${A.esc(v.treat)}</textarea></div>
        <div class="field"><label for="ktTalk">会話のメモ</label><textarea id="ktTalk" rows="3" placeholder="例）来月旅行に行かれる">${A.esc(v.talk)}</textarea></div>
        <div class="field"><label for="ktNext">次回に活かすこと</label><textarea id="ktNext" rows="2" placeholder="例）強めがお好み。部屋は暖かめに">${A.esc(v.next)}</textarea></div>`;
      drawPast();
      key().addEventListener("click", (e) => {
        const svg = e.target.closest("svg"); if (!svg) return;
        const b = svg.getBoundingClientRect();
        const x = Math.round((e.clientX - b.left) / b.width * 160), y = Math.round((e.clientY - b.top) / b.height * 402), sv = svg.dataset.v;
        const hit = pins.map((p, i) => [p.v === sv ? Math.hypot(p.x - x, p.y - y) : 99, i]).sort((p, q) => p[0] - q[0])[0];
        if (hit && hit[0] <= 8) pins.splice(hit[1], 1);
        else if (e.target.classList.contains("kt-hit") || x < 0 || y < 0) return; // 体の外は付けない
        else pins.push({ v: sv, x, y });
        draw(); keep();
      });
      $("ktUndo").onclick = () => { pins.pop(); draw(); keep(); };
      $("ktClear").onclick = () => { if (pins.length && confirm("印を全部消しますか？")) { pins = []; draw(); keep(); } };
      $("ktOld").onchange = draw;
      ["ktTreat", "ktTalk", "ktNext"].forEach((id) => { $(id).oninput = keep; });
      ready = true;
    }).catch((err) => {
      failed = true;
      if (host.isConnected) host.innerHTML = `<p class="err">カルテを読み込めませんでした（${A.esc(err.message)}）。売上だけ保存できます。カルテは開き直してください。</p>`;
    });

    return {
      wait: () => !ready && !failed,
      // お名前を直したら、その方の過去のカルテを出し直す
      async renamed() {
        if (!ready) return;
        try { const { list, my } = await loadPast(); if (my === seq && host.isConnected) { setPast(list); drawPast(); } } catch (e) { /* 過去の表示だけなので続ける */ }
      },
      check() { const v = ready ? val() : null; return v && (cur || sig(v) !== sig({})) && !ctx.name() ? "カルテを残すにはお名前を入れてください" : ""; },
      async save(saleId) {
        if (!ready) return;
        const v = val();
        if (!cur && sig(v) === sig({})) { delete drafts[dkey]; return; } // 何も書いていなければ作らない
        const res = await A.api("karteSave", { item: Object.assign({ id: cur ? cur.id : "", resId: ctx.resId || "", saleId: saleId || ctx.saleId || "",
          day: ctx.day(), name: ctx.name(), tel: ctx.tel || "" }, v) });
        cur = Object.assign({}, cur, { id: res.id });
        delete drafts[dkey];
      },
    };
  }

  // ---------- 見る画面 ----------
  async function openCustomer(c) {
    try {
      const { list } = await A.api("karteList", { name: c.name, tel: c.tel || "", resId: c.resId || "" });
      A.openSheet(`<h3>${A.esc(c.name)} 様のカルテ</h3>
        ${list.length ? history(list, true) : `<div class="empty">まだカルテがありません</div>`}
        <button class="btn btn-ghost" id="ktClose" type="button">閉じる</button>
        <p class="note">同じお名前で、電話番号が違わない方の記録を出しています。書き方が違うと別の方になります。</p>`);
      $("ktClose").onclick = A.closeSheet;
    } catch (err) { A.toast(err.message); }
  }
  function openOne(k) {
    A.openSheet(`<h3>${A.esc(k.name)} 様　${md(k.day)}</h3>${card(k)}
      <button class="btn btn-main" id="ktAll" type="button">この方のカルテを全部見る</button>
      <button class="btn btn-ghost" id="ktDel" type="button">このカルテを取り消す</button>
      <button class="btn btn-ghost" id="ktClose" type="button">閉じる</button>
      <p class="note">直すときは「売上」でこの日の売上を押してください。</p>`);
    $("ktAll").onclick = () => openCustomer(k);
    $("ktClose").onclick = A.closeSheet;
    $("ktDel").onclick = async () => {
      if (!confirm("このカルテを取り消しますか？（画面には出なくなり、表には「取消」として残ります）")) return;
      try { await A.api("karteDelete", { id: k.id }); A.closeSheet(); A.toast("取り消しました"); onSaved(); showList(); } catch (err) { A.toast(err.message); }
    };
  }
  let shown = [];
  async function showList() {
    const q = $("ktQ").value.trim();
    $("ktList").innerHTML = `<div class="empty">読み込んでいます…</div>`;
    try {
      shown = (await A.api("karteList", { q })).list;
      $("ktList").innerHTML = shown.length ? shown.map((k, i) => `<div class="row" data-i="${i}"><div class="t">${Number(k.day.slice(5, 7))}/${Number(k.day.slice(8))}</div>
        <div class="d">${A.esc(k.name)} 様${k.pins.length ? `　<span class="tag web">印${k.pins.length}</span>` : ""}<br><small>${A.esc((k.next || k.treat || k.talk).slice(0, 40))}</small></div></div>`).join("")
        : `<div class="empty">${q ? "見つかりませんでした" : "まだカルテがありません"}</div>`;
    } catch (err) { $("ktList").innerHTML = `<div class="empty">${A.esc(err.message)}</div>`; }
  }

  LM.karte = {
    init(tools) {
      A = tools; onSaved = () => A.refresh().catch(() => {});
      $("ktSearch").addEventListener("submit", (e) => { e.preventDefault(); showList(); });
      $("ktList").addEventListener("click", (e) => { const r = e.target.closest(".row"); if (r) openOne(shown[Number(r.dataset.i)]); });
    },
    form, openCustomer, showList,
  };
})();
