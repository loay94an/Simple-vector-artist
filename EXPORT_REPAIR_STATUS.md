# Rasem – Export Repair Reference

تاريخ التوثيق: 2026-11-06

## 1. المشروع
- الاسم: Simple-vector-artist
- التطبيق: Rasem 2.0
- المنصة: Android / Capacitor
- المسار: ~/Simple-vector-artist

## 2. المشكلة الأساسية
تعطل أو عدم اكتمال تصدير الملفات:
- PNG
- PDF
- SVG

المطلوب: إصلاح التصدير على Android مع الحفاظ على المشروع الحالي.

## 3. الملفات المهمة
- js/storage-export.js
- js/app.js
- android/app/src/main/java/com/rasem/vectorartist/DownloadsPlugin.java
- android/app/src/main/java/com/rasem/vectorartist/MainActivity.java
- capacitor.config.ts

## 4. نتائج الفحص

### JavaScript
- PNGExport موجود.
- PDFExport موجود.
- SVGExport موجود.
- PNG يعتمد على SVG ثم Image ثم Canvas.
- PDF يعتمد على SVG ثم Canvas ثم إنشاء PDF.
- توجد معالجة خاصة بـ Android باستخدام Base64.

### Android
- DownloadsPlugin.java موجود.
- اسم الإضافة: Downloads.
- الدالة الأصلية: save().
- تستخدم ACTION_CREATE_DOCUMENT لاختيار مكان الحفظ.
- تكتب البيانات باستخدام ContentResolver.
- تعيد saved وuri عند نجاح الحفظ.

### تسجيل الإضافة
- MainActivity يسجل DownloadsPlugin.
- JavaScript يحتوي:
  registerPlugin("Downloads")

### Capacitor
- @capacitor/core: ^8.6.0
- @capacitor/filesystem: ^8.1.5
- @capacitor/share: ^8.0.3

## 5. الإصلاحات المنفذة

1. إنشاء نسخة احتياطية:
   js/storage-export.js.before-downloads-fix

2. تغيير استدعاء حفظ PNG من:
   Filesystem.writeFile()
   إلى:
   Downloads.save()

3. تغيير استدعاء حفظ PDF من:
   Filesystem.writeFile()
   إلى:
   Downloads.save()

4. اجتاز الملف:
   node --check js/storage-export.js

5. نجح:
   npm run build

6. نجح:
   npx cap sync android

7. تم التحقق من تسجيل الإضافة في MainActivity.

## 6. الملاحظات والمشكلات المفتوحة

1. downloadBlob() ما زالت تحتوي على مسارات تستخدم
   Filesystem.writeFile().

2. يجب التحقق من توافق جميع مسارات الحفظ مع
   DownloadsPlugin.save().

3. يجب التحقق من بناء Java بنجاح.

4. يجب التحقق من أن التطبيق النهائي يحتوي على
   JavaScript المحدث.

5. لم يتم تأكيد نجاح حفظ PNG وPDF فعلياً على الهاتف.

6. لم يتم إجراء اختبار نهائي لتصدير SVG.

## 7. آخر نقطة وصلنا إليها

تم فحص:
- MainActivity.java
- DownloadsPlugin.java
- capacitor.config.ts
- js/storage-export.js

الخطوة التالية:
فحص downloadBlob() بالكامل، ثم فحص مسارات
حفظ PNG وPDF، ثم تنفيذ بناء Android.

## 8. خطة العمل المتبقية

[ ] فحص downloadBlob().
[ ] مراجعة توافق Downloads.save() مع Java.
[ ] فحص معالجة الأخطاء والإلغاء.
[ ] فحص إنشاء Base64 وحجم الملفات.
[ ] بناء Java والتحقق من عدم وجود أخطاء.
[ ] بناء التطبيق ومزامنة Capacitor.
[ ] تثبيت التطبيق على الهاتف.
[ ] اختبار تصدير PNG.
[ ] اختبار تصدير PDF.
[ ] اختبار تصدير SVG.
[ ] تأكيد ظهور الملفات في المكان المختار.

## 9. تعليمات إلزامية للإصلاح

- ممنوع استبدال المشروع بالكامل.
- ممنوع إعادة كتابة الملفات كاملة دون ضرورة.
- ممنوع حذف وظائف موجودة.
- يجب أخذ نسخة احتياطية قبل كل تعديل.
- يجب إجراء تعديلات محددة ومحدودة فقط.
- يجب فحص Syntax بعد تعديل JavaScript.
- يجب فحص البناء قبل اعتبار الإصلاح ناجحاً.
- لا تعتبر المشكلة محلولة قبل اختبار التصدير
  فعلياً على Android.

## 10. حالة المشروع

الحالة: الإصلاح الجزئي منفذ، والاختبار النهائي لم يكتمل.

هذا الملف هو المرجع الأساسي لمتابعة العمل
في جلسة لاحقة دون إعادة الفحوص السابقة.
