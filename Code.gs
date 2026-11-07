// Google Apps Script — يحفظ نتائج الطالبات في Google Sheets
// 1) أنشئي جدول Google Sheets جديدًا وافتحي: الإضافات > Apps Script
// 2) الصقي هذا الكود، ثم: نشر > نشر كتطبيق ويب (التنفيذ كـ: أنا، الوصول: أي شخص)
// 3) انسخي رابط التطبيق وضعيه في المتغير SHEET_ENDPOINT داخل index.html
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['الوقت', 'الاسم', 'الرأي المبدئي', 'الأدلة المكتشفة', 'التقويم (محاولة أولى)', 'التوصيات الصحيحة', 'الدور']);
  }
  var d = JSON.parse(e.postData.contents);
  sheet.appendRow([d.time, d.name, d.guess, d.clues, d.quiz, d.stores, d.role]);
  return ContentService.createTextOutput('ok');
}
