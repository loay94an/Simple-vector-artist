# Rasem 2.0 — Android Export Issue Reference

## 1. المشكلة الأساسية
تعطّل أو عدم اكتمال حفظ ملفات PNG وPDF على Android.

المطلوب:
- تصدير SVG.
- تصدير PNG.
- تصدير PDF.
- فتح نافذة Android لاختيار مكان حفظ الملف.
- التأكد من نجاح الكتابة قبل إظهار رسالة النجاح.

## 2. نتائج الفحص

### JavaScript
الملف:
js/storage-export.js

- تم العثور على تسجيل Downloads:
  registerPlugin("Downloads")

- تم العثور على استدعاءات Filesystem.writeFile القديمة.
- تم تعديل مساري حفظ PNG وPDF إلى:
  Downloads.save()

- تم الاحتفاظ بنسخة احتياطية:
  js/storage-export.js.before-downloads-fix

- فحص JavaScript:
  node --check
  SUCCESS

### Android Native Plugin
الملف:
android/app/src/main/java/com/rasem/vectorartist/DownloadsPlugin.java

- اسم الإضافة: Downloads
- الدالة: save()
- استخدام ACTION_CREATE_DOCUMENT.
- استقبال Base64.
- الكتابة باستخدام ContentResolver.
- إرجاع saved وuri عند النجاح.
- إرجاع cancelled عند إلغاء المستخدم.

### MainActivity
الملف:
android/app/src/main/java/com/rasem/vectorartist/MainActivity.java

تم العثور على:
registerPlugin(DownloadsPlugin.class)

### Capacitor
- @capacitor/core: 8.6.0
- @capacitor/filesystem: 8.1.5
- @capacitor/share: 8.0.3

## 3. الإصلاحات المنفذة

1. إنشاء نسخة احتياطية من storage-export.js.
2. تعديل حفظ PNG لاستخدام Downloads.save().
3. تعديل حفظ PDF لاستخدام Downloads.save().
4. بناء تطبيق الويب بنجاح.
5. تنفيذ npx cap sync android بنجاح.
6. التأكد من تسجيل الإضافة في MainActivity.
7. التأكد من وجود Downloads في ملفات JavaScript المبنية.

## 4. نتائج البناء

### Vite
BUILD SUCCESSFUL

### Capacitor Sync
SYNC SUCCESSFUL

### Java
الأمر:
./gradlew :app:compileDebugJavaWithJavac

النتيجة:
BUILD SUCCESSFUL

68 actionable tasks:
12 executed, 56 up-to-date

## 5. المشاكل التي لم تُحسم بعد

مهم: نجاح البناء لا يعني أن التصدير يعمل فعلياً على الهاتف.

هناك نقاط تحتاج إلى فحص:

1. الدالة downloadBlob() ما زالت تستخدم Filesystem.writeFile()
   في بعض مسارات الحفظ الأصلية.

2. مسارات حفظ PNG وPDF تستخدم Downloads.save()
   بينما مسارات أخرى تستخدم Filesystem.

3. توجد رسائل تشخيص alert كثيرة داخل كود التصدير.

4. يجب التأكد من أن Downloads.save()
   يعمل فعلياً وقت تشغيل التطبيق.

5. يجب اختبار حفظ PNG وPDF وSVG على جهاز Android.

6. يجب فحص سلامة ملفات PDF الناتجة وفتحها.

## 6. نقطة التوقف الحالية

آخر خطوة مكتملة:
نجاح تجميع Java لإضافة Downloads.

آخر نتيجة:
BUILD SUCCESSFUL

لم يتم إثبات نجاح الحفظ الفعلي على الهاتف بعد.

## 7. الخطوات التالية

الخطوة الأولى:
فحص MainActivity وترتيب تسجيل الإضافة بشكل صحيح.

الخطوة الثانية:
توحيد جميع مسارات الحفظ الأصلية لتستخدم Downloads.save()
بدلاً من Filesystem.writeFile() عندما تكون العملية حفظاً عبر Android.

الخطوة الثالثة:
مراجعة معالجة Base64 والأخطاء والإلغاء.

الخطوة الرابعة:
إزالة رسائل التشخيص المؤقتة بعد انتهاء الاختبار.

الخطوة الخامسة:
تنفيذ:
npm run build
npx cap sync android
cd android
./gradlew assembleDebug

الخطوة السادسة:
تثبيت APK على الهاتف واختبار PNG وPDF وSVG.

## 8. تعليمات المتابعة

لا تعِد كتابة المشروع.
لا تحذف النسخ الاحتياطية.
لا تغيّر ملفات غير مرتبطة بالمشكلة.
افحص الكود قبل كل تعديل.
احتفظ بنسخة احتياطية قبل الإصلاح.
لا تعتبر البناء ناجحاً دليلاً على نجاح الحفظ.
