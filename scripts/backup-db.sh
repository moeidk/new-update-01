#!/usr/bin/env bash
# ==============================================================================
# scripts/backup-db.sh
# Pre-Deployment Automated Database & State Backup Script
# ==============================================================================
# این اسکریپت قبل از هر مرحله دیپلوی اجرا می‌شود تا از سلامت و پایداری داده‌ها
# اطمینان حاصل شده و نسخه پشتیبان با برچسب زمان و هش اعتبارسنجی آرشیو شود.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TARGET_BACKUP_PATH="${BACKUP_DIR}/backup_${TIMESTAMP}"

mkdir -p "${BACKUP_DIR}"

echo "=========================================================="
echo "🛡️  شروع فرآیند پشتیبان‌گیری خودکار داده‌ها قبل از استقرار"
echo "زمان: $(date)"
echo "مسیر ذخیره‌سازی: ${TARGET_BACKUP_PATH}"
echo "=========================================================="

# ۱. پشتیبان‌گیری از فایل‌های استاتیک، پیکربندی‌ها و متادیتا
mkdir -p "${TARGET_BACKUP_PATH}"

if [ -f "public/version.json" ]; then
  cp "public/version.json" "${TARGET_BACKUP_PATH}/pre_deploy_version.json"
fi

if [ -f "package.json" ]; then
  cp "package.json" "${TARGET_BACKUP_PATH}/package.json"
fi

# ۲. پشتیبان‌گیری از دیتابیس SQLite در صورت وجود
if [ -f "data/vault.sqlite" ]; then
  echo "📦 پشتیبان‌گیری از دیتابیس SQLite..."
  sqlite3 "data/vault.sqlite" ".backup '${TARGET_BACKUP_PATH}/vault.sqlite'"
fi

# ۳. پشتیبان‌گیری از PostgreSQL در صورت تنظیم بودن متغیر DATABASE_URL
if [ -n "${DATABASE_URL:-}" ]; then
  echo "🐘 پشتیبان‌گیری از دیتابیس PostgreSQL..."
  pg_dump "${DATABASE_URL}" --format=custom --file="${TARGET_BACKUP_PATH}/postgres_dump.dump" || {
    echo "⚠️ اخطار در اجرای pg_dump؛ متغیر بررسی شود."
  }
fi

# ۴. فشرده‌سازی آرشیو پشتیبان با tar.gz
ARCHIVE_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.tar.gz"
tar -czf "${ARCHIVE_FILE}" -C "${BACKUP_DIR}" "backup_${TIMESTAMP}"
rm -rf "${TARGET_BACKUP_PATH}"

# ۵. محاسبه هش SHA256 جهت تضمین عدم دستکاری
if command -v sha256sum &> /dev/null; then
  sha256sum "${ARCHIVE_FILE}" > "${ARCHIVE_FILE}.sha256"
  echo "🔑 هش اعتبارسنجی SHA256:"
  cat "${ARCHIVE_FILE}.sha256"
fi

echo "✅ پشتیبان با موفقیت ایجاد شد: ${ARCHIVE_FILE}"

# ۶. پاکسازی پشتیبان‌های قدیمی (نگهداری ۱۰ پشتیبان اخیر)
echo "🧹 پاکسازی نسخه‌های قدیمی‌تر از ۱۰ نسخه اخیر..."
cd "${BACKUP_DIR}"
ls -t backup_*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm --
ls -t backup_*.tar.gz.sha256 2>/dev/null | tail -n +11 | xargs -r rm --

echo "🎯 فرآیند پشتیبان‌گیری با موفقیت به پایان رسید."
exit 0
