// Lapis Mayumi の設定。値を変えるのはこのファイルだけでよい。
window.LM = window.LM || {};
LM.CONFIG = {
  SALON_NAME: "Lapis Mayumi",

  // Apps Script を「ウェブアプリ」として公開したURL（/exec で終わる）。
  // 空のままだと、端末の中だけで動く見本モード（データは保存されない）になる。
  API_URL: "https://script.google.com/macros/s/AKfycbylbweYRb6vKZV-VSe2IZlJiLP1o43hdf7KiHdpR9cid8dEIz1IJz5qkgssekeWzryzdw/exec", // 2026-10-30 店主の Google（バージョン1）

  // LINE の LIFF ID（任意）。入れると、予約画面を開いた人の LINE の名前が自動で付く。
  LIFF_ID: "",

  // 公式LINEの友だち追加URL（例: https://lin.ee/xxxx）。ホームページのボタンに使う。
  LINE_URL: "https://line.me/R/ti/p/%40419orjtl",
  LINE_ID: "@419orjtl", // 予約画面の最後に、お客様がこの公式LINEへ予約番号を送る
  // ⚠ 施術場所（住所）はここに書かない。誰でも読めるファイルなので。決まり文は gas/Code.gs と assets/place_default.js
  // 駐車場の写真のページ（確定のご連絡の最後にリンクを入れる。空なら入れない。2026-10-31 提案96）
  PARKING_URL: "https://lapismayumi.taccweb.com/pk/8b784f94.html",

  // メールでのお問い合わせ先（空なら表示しない）
  MAIL: "mayumi0603r628@gmail.com",

  // SNS（空なら表示しない）
  SNS: { instagram: "https://www.instagram.com/lapis_mayumi/", tiktok: "https://www.tiktok.com/@lapis_mayumi", youtube: "" },

  // コース。price は税込の定価（円）。null なら料金を表示しない。
  COURSES: [
    { minutes: 60, label: "60分コース", price: 9000 },
    { minutes: 90, label: "90分コース", price: 13500 },
    { minutes: 120, label: "120分コース", price: 18000 },
  ],

  // お支払い方法（ホームページに出す）
  PAYMENTS: [
    { group: "現金", items: ["現金"] },
    { group: "クレジットカード（タッチ決済対応）", items: ["VISA", "Mastercard", "JCB", "American Express", "銀聯（UnionPay）", "Diners Club", "Discover"] },
    { group: "電子マネー", items: ["Apple Pay", "iD", "QUICPay"] },
    { group: "交通系IC", items: ["Suica", "PASMO", "Kitaca", "TOICA", "manaca", "ICOCA", "SUGOCA", "nimoca", "はやかけん"], note: "PiTaPaはご利用いただけません" },
    { group: "QRコード決済", items: ["PayPay", "d払い", "au PAY", "楽天ペイ", "J-Coin Pay", "COIN+", "Smart Code", "WeChat Pay", "銀聯QR", "Alipay+"] },
  ],
  DEFAULT_COURSE: 90,

  OPEN: "10:00",        // 最初の開始時刻
  LAST_START: "17:00",  // 最後の開始時刻（それ以外の時間は公式LINEで相談）
  STEP_MIN: 30,         // 時間の刻み
  BUFFER_MIN: 60,       // 予約と予約の間に空ける時間（2026-10-29 店主の希望で1時間）
  LEAD_HOURS: 3,        // 今から何時間後から申し込めるか
  HORIZON_MONTHS: 2,    // 画面に出す期間（今日から何か月先まで）
};
