// 帳簿（売上・経費の記録と freee 取り込み用ファイルの書き出し）2026-11-16 作成。裏側は gas/経理.gs
// ⚠ 記録と書き出しだけの道具。何をいくら経費にするか・申告は店主ご本人が決める。
(function () {
  const SALE_METHODS = ["現金", "クレジットカード", "電子マネー・交通系IC", "QRコード決済", "銀行振込", "その他"];
  const EXP_METHODS = ["現金", "クレジットカード", "口座引き落とし", "銀行振込", "その他"];
  // gas/経理.gs の defaultKeiriSettings と同じ（見本モード用）
  LM.keiriDefaults = () => {
    const t = "課対仕入10%";
    return {
      saleTax: "課税売上10%",
      accounts: [["消耗品費", t], ["水道光熱費", t], ["通信費", t], ["地代家賃", "非課仕入"], ["広告宣伝費", t], ["旅費交通費", t],
        ["研修費", t], ["新聞図書費", t], ["支払手数料", t], ["保険料", "非課仕入"], ["租税公課", "対象外"], ["雑費", t]].map((a) => ({ name: a[0], tax: a[1] })),
      salePay: { 現金: "事業主貸", クレジットカード: "", "電子マネー・交通系IC": "", QRコード決済: "", 銀行振込: "", その他: "事業主貸" },
      expensePay: { 現金: "事業主借", クレジットカード: "事業主借", 口座引き落とし: "事業主借", 銀行振込: "事業主借", その他: "事業主借" },
    };
  };

  let A = null;        // admin.js から渡される道具
  let book = null;     // その年の売上・経費・設定
  let year = null;
  let seg = "sale";
  const $ = (id) => document.getElementById(id);
  const yen = (n) => "¥" + Number(n || 0).toLocaleString("ja-JP");
  const opt = (list, v) => list.map((x) => `<option ${x === v ? "selected" : ""}>${A.esc(x)}</option>`).join("");
  const todayKey = () => A.dayKeyOf(Date.now());
  const md = (day) => { const p = day.split("-"); return `${Number(p[1])}/${Number(p[2])}`; };

  async function load(y) {
    year = y || year || Number(todayKey().slice(0, 4));
    book = await A.api("keiriList", { year });
    render();
  }

  // ---------- 一覧 ----------
  function render() {
    if (!book) return;
    const ys = [year - 1, year, year + 1].filter((y) => y >= 2026);
    $("kYear").innerHTML = ys.map((y) => `<option value="${y}" ${y === year ? "selected" : ""}>${y}年</option>`).join("");
    document.querySelectorAll("#kSeg button").forEach((b) => b.classList.toggle("on", b.dataset.k === seg));
    ["kSale", "kExp", "kOut"].forEach((id) => $(id).classList.add("hidden"));
    if (seg === "sale") renderSales();
    if (seg === "exp") renderExpenses();
    if (seg === "out") renderOut();
  }
  function monthGroups(list, rowHtml) {
    const live = list.filter((r) => r.state !== "取消").sort((a, b) => (b.day + b.id).localeCompare(a.day + a.id));
    if (!live.length) return `<div class="empty">まだ記録がありません</div>`;
    let html = "", cur = "", sum = 0;
    const months = {};
    live.forEach((r) => { const m = r.day.slice(0, 7); months[m] = (months[m] || 0) + r.amount; });
    live.forEach((r) => {
      const m = r.day.slice(0, 7);
      if (m !== cur) { cur = m; html += `<div class="day-h">${Number(m.slice(5))}月<span class="k-sum">${yen(months[m])}</span></div>`; }
      html += rowHtml(r); sum += r.amount;
    });
    return `<div class="k-total">${year}年の合計 <b>${yen(sum)}</b>（${live.length}件）</div>` + html;
  }
  function renderSales() {
    $("kSale").classList.remove("hidden");
    $("kSaleList").innerHTML = monthGroups(book.sales, (r) => `
      <div class="row" data-s="${A.esc(r.id)}"><div class="t">${md(r.day)}</div>
      <div class="d">${A.esc(r.name || "（名前なし）")}${r.minutes ? `　${r.minutes}分` : ""}<br><small>${A.esc(r.method)}${r.memo ? "／" + A.esc(r.memo) : ""}</small></div>
      <div class="k-amt">${yen(r.amount)}</div></div>`);
  }
  function renderExpenses() {
    $("kExp").classList.remove("hidden");
    $("kExpList").innerHTML = monthGroups(book.expenses, (r) => `
      <div class="row" data-e="${A.esc(r.id)}"><div class="t">${md(r.day)}</div>
      <div class="d">${A.esc(r.account)}${r.imageId ? " 📷" : ""}<br><small>${A.esc(r.payee || "")}${r.memo ? "／" + A.esc(r.memo) : ""}</small></div>
      <div class="k-amt">${yen(r.amount)}</div></div>`);
  }

  // ---------- 売上の入力（施術完了・あとから直す・予約なし） ----------
  function openSale(s, r) {
    // s: 既存の売上（直すとき）／ r: 予約（施術完了のとき）
    const C = LM.CONFIG;
    const minutes = s ? s.minutes : r ? r.minutes : "";
    const course = C.COURSES.find((c) => c.minutes === Number(minutes));
    const it = s || { day: r ? A.dayKeyOf(r.start) : todayKey(), name: r ? r.name : "", minutes, amount: course ? course.price : "", method: "現金", memo: "", resId: r ? r.id : "" };
    A.openSheet(`<h3>${s ? "売上を直す" : r ? "施術完了（売上を記録）" : "売上を入れる"}</h3>
      <div class="two">
        <div class="field"><label for="kDay">日付</label><input type="date" id="kDay" value="${A.esc(it.day)}"></div>
        <div class="field"><label for="kMin">コース</label><select id="kMin"><option value="">なし・その他</option>${C.COURSES.map((c) => `<option value="${c.minutes}" ${c.minutes === Number(it.minutes) ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="kName">お名前</label><input type="text" id="kName" value="${A.esc(it.name)}"></div>
      <div class="two">
        <div class="field"><label for="kAmt">受け取った金額（円）</label><input type="number" inputmode="numeric" id="kAmt" value="${A.esc(it.amount)}"></div>
        <div class="field"><label for="kPay">支払方法</label><select id="kPay">${opt(SALE_METHODS, it.method)}</select></div>
      </div>
      <div class="field"><label for="kMemo">メモ（割引の理由など）</label><input type="text" id="kMemo" value="${A.esc(it.memo)}"></div>
      <button class="btn btn-main" id="kSave" type="button">保存する</button>
      ${s ? `<button class="btn btn-ghost" id="kDel" type="button">この売上を取り消す</button>` : ""}
      <button class="btn btn-ghost" id="kClose" type="button">閉じる</button>
      <p class="note">金額は割引などがあれば、実際に受け取った金額に直してください。</p>`);
    $("kMin").onchange = () => { const c = C.COURSES.find((x) => x.minutes === Number($("kMin").value)); if (c && c.price) $("kAmt").value = c.price; };
    $("kClose").onclick = A.closeSheet;
    $("kSave").onclick = () => send("saleSave", { item: { id: s ? s.id : "", resId: it.resId || "", day: $("kDay").value, name: $("kName").value.trim(),
      minutes: $("kMin").value, amount: $("kAmt").value, method: $("kPay").value, memo: $("kMemo").value.trim() } }, $("kSave"));
    if ($("kDel")) $("kDel").onclick = () => { if (confirm("この売上を取り消しますか？（表には「取消」として残り、freee用のファイルには出ません）")) send("keiriDelete", { kind: "sale", id: s.id }, $("kDel")); };
  }

  // ---------- 経費の入力 ----------
  function openExpense(e) {
    const accounts = book.settings.accounts.map((a) => a.name);
    const it = e || { day: todayKey(), account: accounts[0], payee: "", amount: "", method: "現金", memo: "" };
    A.openSheet(`<h3>${e ? "経費を直す" : "経費を入れる"}</h3>
      <div class="two">
        <div class="field"><label for="xDay">日付</label><input type="date" id="xDay" value="${A.esc(it.day)}"></div>
        <div class="field"><label for="xAmt">金額（円・税込）</label><input type="number" inputmode="numeric" id="xAmt" value="${A.esc(it.amount)}"></div>
      </div>
      <div class="field"><label for="xAcc">何の費用か（勘定科目）</label><select id="xAcc">${opt(accounts, it.account)}</select></div>
      <div class="two">
        <div class="field"><label for="xPayee">お店・支払先</label><input type="text" id="xPayee" value="${A.esc(it.payee)}" placeholder="例）ダイソー"></div>
        <div class="field"><label for="xPay">支払方法</label><select id="xPay">${opt(EXP_METHODS, it.method)}</select></div>
      </div>
      <div class="field"><label for="xImg">レシート・領収書の写真</label><input type="file" id="xImg" accept="image/*">
        ${it.imageUrl && !/#見本$/.test(it.imageUrl) ? `<p class="note"><a href="${A.esc(it.imageUrl)}" target="_blank" rel="noopener">保存済みの写真を見る</a>（選び直すと差し替わります）</p>` : it.imageId ? `<p class="note">写真は保存済みです（選び直すと差し替わります）</p>` : ""}</div>
      <div class="field"><label for="xMemo">メモ（何を買ったか）</label><input type="text" id="xMemo" value="${A.esc(it.memo)}" placeholder="例）施術用のタオル"></div>
      <button class="btn btn-main" id="xSave" type="button">保存する</button>
      ${e ? `<button class="btn btn-ghost" id="xDel" type="button">この経費を取り消す</button>` : ""}
      <button class="btn btn-ghost" id="xClose" type="button">閉じる</button>
      <p class="note">紙のレシートも捨てずに保管してください。</p>`);
    $("xClose").onclick = A.closeSheet;
    $("xSave").onclick = async () => {
      const btn = $("xSave");
      let image = null;
      const f = $("xImg").files[0];
      if (f) { btn.disabled = true; btn.textContent = "写真を準備しています…"; try { image = await shrink(f); } catch (err) { btn.disabled = false; btn.textContent = "保存する"; A.toast("写真を読み込めませんでした。別の写真を選んでください"); return; } }
      send("expenseSave", { item: { id: e ? e.id : "", day: $("xDay").value, account: $("xAcc").value, payee: $("xPayee").value.trim(),
        amount: $("xAmt").value, method: $("xPay").value, memo: $("xMemo").value.trim() }, image }, btn);
    };
    if ($("xDel")) $("xDel").onclick = () => { if (confirm("この経費を取り消しますか？（表と写真は残り、freee用のファイルには出ません）")) send("keiriDelete", { kind: "expense", id: e.id }, $("xDel")); };
  }
  // 写真は長い辺を1600pxに縮めて JPEG にする（送る量を減らす）
  async function shrink(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, ng) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ng; i.src = url; });
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return { type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.82).split(",")[1] };
    } finally { URL.revokeObjectURL(url); }
  }

  async function send(action, payload, btn) {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "保存しています…";
    try {
      await A.api(action, payload);
      A.closeSheet(); A.toast(action === "keiriDelete" ? "取り消しました" : "保存しました");
      await load();
      A.refresh().catch(() => {}); // 予定表の「売上済」を更新
    } catch (err) {
      btn.disabled = false; btn.textContent = label;
      A.toast("保存できませんでした：" + err.message);
    }
  }

  // ---------- freee 用のファイル ----------
  const HEAD = ["収支区分", "管理番号", "発生日", "決済期日", "取引先コード", "取引先", "勘定科目", "税区分", "金額", "税計算区分", "税額", "備考", "品目", "部門",
    "メモタグ（複数指定可、カンマ区切り）", "セグメント1", "セグメント2", "セグメント3", "決済日", "決済口座", "決済金額"];
  const q = (v) => { const s = String(v == null ? "" : v); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const slash = (d) => d.replace(/-/g, "/");
  function csvRows(from, to) {
    const st = book.settings, rows = [];
    const inRange = (r) => r.state !== "取消" && r.day >= from && r.day <= to;
    const pay = (acc, r) => acc ? [slash(r.day), acc, r.amount] : ["", "", ""];
    book.sales.filter(inRange).sort((a, b) => a.day.localeCompare(b.day)).forEach((r) => {
      rows.push(["収入", r.id, slash(r.day), "", "", "", "売上高", st.saleTax, r.amount, "内税", "", r.memo || "",
        r.minutes ? r.minutes + "分コース" : "施術", "", "", "", "", ""].concat(pay(st.salePay[r.method], r)));
    });
    const taxOf = {}; st.accounts.forEach((a) => { taxOf[a.name] = a.tax; });
    book.expenses.filter(inRange).sort((a, b) => a.day.localeCompare(b.day)).forEach((r) => {
      rows.push(["支出", r.id, slash(r.day), "", "", r.payee || "", r.account, taxOf[r.account] || "課対仕入10%", r.amount, "内税", "",
        [r.memo, r.imageUrl && !/#見本$/.test(r.imageUrl) ? "写真 " + r.imageUrl : ""].filter(Boolean).join(" "),
        "", "", "", "", "", ""].concat(pay(st.expensePay[r.method], r)));
    });
    return rows;
  }
  function renderOut() {
    $("kOut").classList.remove("hidden");
    if (!$("kFrom").value || $("kFrom").value.slice(0, 4) !== String(year)) { $("kFrom").value = year + "-01-01"; $("kTo").value = year + "-12-31"; }
    countOut();
    renderMap();
  }
  function countOut() {
    const rows = csvRows($("kFrom").value, $("kTo").value);
    const n = (k) => rows.filter((r) => r[0] === k).length;
    $("kOutCount").textContent = `売上 ${n("収入")}件・経費 ${n("支出")}件が入ります`;
  }
  function download() {
    const from = $("kFrom").value, to = $("kTo").value;
    if (!from || !to || from > to) { A.toast("期間を正しく入れてください"); return; }
    if (from.slice(0, 4) !== String(year) || to.slice(0, 4) !== String(year)) { A.toast("期間は表示中の年（" + year + "年）の中で選んでください"); return; }
    const rows = csvRows(from, to);
    if (!rows.length) { A.toast("この期間の記録がありません"); return; }
    const text = "﻿" + [HEAD].concat(rows).map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = `freee取引_${from.replace(/-/g, "")}-${to.replace(/-/g, "")}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    A.toast("ファイルを作りました");
  }

  // 取り込みの設定（勘定科目・税区分・決済口座）
  function renderMap() {
    const st = book.settings;
    const payRows = (methods, map, idp) => methods.map((m, i) => `<div class="two k-map"><div>${A.esc(m)}</div><input type="text" id="${idp}${i}" value="${A.esc(map[m] || "")}" placeholder="空欄＝未決済"></div>`).join("");
    $("kMap").innerHTML = `
      <div class="field"><label for="kSaleTax">売上の税区分</label><input type="text" id="kSaleTax" value="${A.esc(st.saleTax)}"></div>
      <span class="lbl">売上：支払方法ごとの freee の決済口座</span>${payRows(SALE_METHODS, st.salePay, "kSP")}
      <span class="lbl" style="margin-top:12px">経費：支払方法ごとの freee の決済口座</span>${payRows(EXP_METHODS, st.expensePay, "kEP")}
      <div class="field" style="margin-top:12px"><label for="kAcc">経費の勘定科目と税区分（1行に「科目,税区分」）</label>
        <textarea id="kAcc" rows="10">${A.esc(st.accounts.map((a) => a.name + "," + a.tax).join("\n"))}</textarea></div>
      <button class="btn btn-main" id="kMapSave" type="button">設定を保存する</button>`;
    $("kMapSave").onclick = () => {
      const pick = (methods, idp) => { const o = {}; methods.forEach((m, i) => { o[m] = $(idp + i).value.trim(); }); return o; };
      const accounts = $("kAcc").value.split("\n").map((l) => l.split(/[,、，]/)).filter((p) => p[0] && p[0].trim())
        .map((p) => ({ name: p[0].trim(), tax: (p[1] || "課対仕入10%").trim() }));
      send("keiriSettings", { settings: { saleTax: $("kSaleTax").value.trim(), salePay: pick(SALE_METHODS, "kSP"), expensePay: pick(EXP_METHODS, "kEP"), accounts } }, $("kMapSave"));
    };
  }

  // ---------- admin.js から呼ばれる ----------
  LM.keiri = {
    init(tools) {
      A = tools;
      $("kSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { seg = b.dataset.k; render(); } });
      $("kYear").onchange = () => load(Number($("kYear").value)).catch((err) => A.toast(err.message));
      $("kAddSale").onclick = () => openSale(null, null);
      $("kAddExp").onclick = () => openExpense(null);
      $("kSaleList").addEventListener("click", (e) => { const r = e.target.closest(".row"); if (r) openSale(book.sales.find((x) => x.id === r.dataset.s), null); });
      $("kExpList").addEventListener("click", (e) => { const r = e.target.closest(".row"); if (r) openExpense(book.expenses.find((x) => x.id === r.dataset.e)); });
      $("kFrom").onchange = countOut; $("kTo").onchange = countOut;
      $("kDl").onclick = download;
    },
    show() { load().catch((err) => A.toast(err.message)); },
    // 予約から：施術完了（売上がまだ）／売上を直す（記録済み）
    async fromReservation(r, saleId) {
      try {
        const y = Number(A.dayKeyOf(r.start).slice(0, 4));
        if (!book || year !== y) { year = y; book = await A.api("keiriList", { year }); }
        const s = saleId ? book.sales.find((x) => x.id === saleId) : null;
        openSale(s, s ? null : r);
      } catch (err) { A.toast(err.message); }
    },
  };
})();
