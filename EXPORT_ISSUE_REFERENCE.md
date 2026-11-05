# RASEM 2.0 - Export Issue Reference

تاريخ التوثيق: 2026-11-06

## 1. وصف المشكلة

المشروع: Simple-vector-artist
التطبيق: RASEM 2.0
البيئة: Android / Termux / Capacitor

المشكلة الأساسية:
تعطل أو عدم اكتمال تصدير وحفظ ملفات PNG وPDF على Android.

المطلوب:
إصلاح التصدير مع المحافظة على المشروع الحالي دون إعادة بنائه أو استبداله.

## 2. نتائج الفحص العام

ملف JavaScript المبني:
android/app/src/main/assets/public/assets/index-BE8ZqBtf.js

نتائج الفحص:
- node --check: SUCCESS
- exportSVG: 3
- exportPNG: 3
- exportPDF: 3
- PNG-DIAG: FOUND
- PNG-SAVE: FOUND
- PNG-EXP-ERR: FOUND
- PDF-DIAG: FOUND
- PDF-SAVE: FOUND
- F.writeFile: 6

ملاحظة:
نجاح فحص Syntax لا يعني نجاح التصدير أثناء التشغيل.

## 3. الملفات المهمة

JavaScript:
- js/storage-export.js
- js/app.js

Android:
- android/app/src/main/java/com/rasem/vectorartist/DownloadsPlugin.java

إعدادات:
- capacitor.config.ts
- package.json

ملفات الذكاء الاصطناعي:
- ai.py
- ai.pyx
- ai_scan.py
- ai_repair.py
- ai_diagnosis.txt

## 4. نتائج فحص كود PNG

الموقع:
js/storage-export.js
الأسطر 1183-1298

التنفيذ الحالي:
1. DocumentFormat.normalize
2. SVGExport.generate
3. إنشاء SVG Blob
4. تحميل SVG باستخدام Image
5. رسم الصورة داخل Canvas
6. التحويل إلى Base64 على Android باستخدام toDataURL
7. إرسال البيانات إلى Filesystem.writeFile

نقاط تحتاج التحقيق:
- صحة تحويل Canvas إلى Base64.
- حجم الصور والذاكرة.
- توافق عملية الحفظ مع Android.
- التوافق بين Filesystem وDownloads Plugin.

## 5. نتائج فحص كود PDF

الموقع:
js/storage-export.js
الأسطر 1304-1527

التنفيذ الحالي:
1. إنشاء SVG.
2. تحويل SVG إلى Image.
3. الرسم على Canvas.
4. إنشاء بيانات JPEG أو RGB.
5. إنشاء PDF 1.4 يدويًا.
6. إنشاء PDF Blob.
7. تحويل PDF إلى Base64 على Android.
8. استدعاء Filesystem.writeFile للحفظ.

نقاط تحتاج التحقيق:
- صحة بنية PDF.
- صحة XRef offsets.
- صحة Image XObject.
- صحة Alpha Soft Mask عند الشفافية.
- حجم Base64 واستهلاك الذاكرة.
- نجاح الحفظ الفعلي على Android.

## 6. نتائج فحص Android Native Plugin

الملف:
android/app/src/main/java/com/rasem/vectorartist/DownloadsPlugin.java

اسم Plugin:
Downloads

الدالة:
save(PluginCall call)

آلية العمل:
1. استقبال filename وmimeType وdata.
2. فتح ACTION_CREATE_DOCUMENT.
3. عرض نافذة اختيار مكان الحفظ.
4. استقبال Uri.
5. فك Base64 باستخدام Base64.decode.
6. كتابة الملف باستخدام ContentResolver.
7. إرجاع:
   saved = true
   uri
   filename

ملاحظة مهمة:
واجهة Java تستقبل بيانات الحفظ عبر Downloads.save.

لكن JavaScript المعروض يستدعي:
Filesystem.writeFile

وهذا اختلاف مهم يجب التحقق منه.
يجب فحص تسجيل Plugin وطريقة استدعائه قبل اقتراح أي تعديل.

## 7. إصدارات Capacitor

من package.json:

@capacitor/core: ^8.6.0
@capacitor/filesystem: ^8.1.5
@capacitor/share: ^8.0.3

## 8. نتائج الذكاء الاصطناعي OpenRouter

تم ربط OpenRouter سابقًا.

المتغير:
OPENROUTER_API_KEY

حالة المفتاح عند آخر فحص:
AVAILABLE

النموذج المستخدم:
cohere/north-mini-code:free

المشكلات التي ظهرت:

أولاً:
HTTP 400
السبب:
تجاوز الحد الأقصى للسياق.
المطلوب حوالي 283792 tokens مقابل حد 256000.

ثانيًا:
HTTP 429
السبب:
استنفاد الحصة اليومية للنماذج المجانية.

ثالثًا:
ai_scan.py أجرى محاولات تحليل كثيرة.
ظهرت أخطاء في الأجزاء 61-64.

رابعًا:
ai_repair.py لم يكمل التحليل النهائي بسبب HTTP 429.

التقرير ai_diagnosis.txt:
حجمه الأخير المسجل حوالي 629 KB.

التقرير لا يمثل تشخيصًا نهائيًا موثوقًا؛
بعض أجزائه تحتوي على أخطاء API أو تحليل عام غير مرتبط بالكود الفعلي.

## 9. أين وصلنا؟

[مكتمل]
- فحص JavaScript syntax.
- تحديد ملفات التصدير.
- استخراج كود PNG.
- استخراج كود PDF.
- فحص DownloadsPlugin.java.
- معرفة إصدارات Capacitor.
- تحديد مشاكل حصة OpenRouter والسياق.

[غير مكتمل]
- التحقق من تسجيل Downloads Plugin.
- مقارنة استدعاءات JavaScript مع واجهة Java.
- تشخيص سبب فشل PNG بصورة مؤكدة.
- تشخيص سبب فشل PDF بصورة مؤكدة.
- اختبار الحفظ على جهاز Android.
- الحصول على اقتراح إصلاح نهائي من الذكاء الاصطناعي.

## 10. خطة العمل القادمة

المرحلة الأولى:
فحص تسجيل Downloads Plugin داخل MainActivity.java
وفحص registerPlugin في js/storage-export.js.

المرحلة الثانية:
تحديد سبب اختلاف Filesystem.writeFile عن Downloads.save.

المرحلة الثالثة:
إرسال الملفات والمقاطع المرتبطة فقط إلى OpenRouter.
عدم إرسال المشروع كاملًا.
عدم تجاوز حدود السياق.

المرحلة الرابعة:
طلب تقرير هندسي يحدد:
- الخطأ المؤكد.
- الدليل ورقم السطر.
- سبب المشكلة.
- الإصلاح المحدود المقترح.
- تأثير الإصلاح على بقية الوظائف.
- اختبارات التحقق.

المرحلة الخامسة:
مراجعة الاقتراح والموافقة عليه قبل تطبيق أي تعديل.

## 11. قيود إلزامية

1. ممنوع استبدال المشروع بالكامل.
2. ممنوع إعادة كتابة التطبيق.
3. ممنوع حذف الوظائف الحالية.
4. ممنوع تعديل الملفات دون موافقة المستخدم.
5. ممنوع تطبيق إصلاح تخميني.
6. يجب الاحتفاظ بالنسخ الاحتياطية.
7. يجب اختبار SVG وPNG وPDF كل على حدة.
8. يجب التأكد من نجاح الحفظ الفعلي على Android.
9. يجب تقديم التغييرات على شكل إصلاحات صغيرة ومحددة.

## 12. تعليمات استئناف العمل

عند استئناف العمل:

اقرأ هذا الملف أولاً.

لا تعاود الفحوص المكتملة.

ابدأ بفحص تسجيل Downloads Plugin
ومقارنة واجهة JavaScript مع Java.

الهدف:
إصلاح تصدير PNG وPDF في المشروع الحالي
بأقل تغييرات ممكنة ودون استبدال المشروع.

END OF REFERENCE
