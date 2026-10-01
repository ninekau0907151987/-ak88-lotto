/**
 * src/shared/lib/firebase.ts
 * ==================================================================
 * ★ ปิด Firebase Firestore เรียบร้อยแล้ว -> สลับใช้ Supabase PostgreSQL 100% ★
 * ==================================================================
 */

export * from './supabase-firestore-adapter';
export { db, supabaseClient } from './supabase-firestore-adapter';
