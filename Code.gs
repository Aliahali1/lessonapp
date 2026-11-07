// Google Apps Script — يحفظ نتائج المجموعات في Google Sheets ويعيدها للوحة المعلمة
// 1) أنشئي جدول Google Sheets جديدًا ثم: الإضافات > Apps Script
// 2) الصقي هذا الكود، ثم: نشر > نشر كتطبيق ويب (التنفيذ كـ: أنا، الوصول: أي شخص)
// 3) انسخي رابط التطبيق وضعيه في SHEET_ENDPOINT داخل js/config.js
// ملاحظة: يُخزَّن لكل تحديث صف جديد؛ لوحة المعلمة تأخذ أحدث صف لكل مجموعة.
function doPost(e) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(['الوقت', 'المجموعة', 'الإنجاز %', 'JSON']);
  var d = JSON.parse(e.postData.contents);
  sh.appendRow([d.updated, d.group, d.progress, JSON.stringify(d)]);
  return ContentService.createTextOutput('ok');
}
function doGet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 4, sh.getLastRow() - 1, 1).getValues() : [];
  var out = rows.map(function (r) { try { return JSON.parse(r[0]); } catch (x) { return null; } }).filter(Boolean);
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
