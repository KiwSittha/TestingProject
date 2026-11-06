// ตั้งรหัสผ่านของบัญชีทดสอบ (cus_normal, cus_prime, admin01) ให้เป็นค่าใน .env
// สร้าง bcrypt hash จาก TEST_PASSWORD (หรือ TEST_PASSWORD_<USERNAME>) แล้วบันทึกลง users.password_hash
// รัน: node scripts/set-test-passwords.mjs
// หมายเหตุ: เปลี่ยนรหัสของ 3 บัญชีนี้สำหรับทุกคนที่ใช้ฐานข้อมูลเดียวกัน
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

for (const username of ['cus_normal', 'cus_prime', 'admin01']) {
  const password = process.env[`TEST_PASSWORD_${username.toUpperCase()}`] ?? process.env.TEST_PASSWORD;
  if (!password) {
    console.log(`${username}: ข้าม เพราะไม่มี TEST_PASSWORD ใน .env`);
    continue;
  }

  const hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .update({ password_hash: hash })
    .eq('username', username)
    .select('username');

  if (error) {
    console.log(`${username}: บันทึกไม่ได้ -> ${error.message}`);
  } else if (!data || data.length === 0) {
    console.log(`${username}: ไม่พบบัญชีนี้ในตาราง users`);
  } else {
    const ok = await bcrypt.compare(password, hash);
    console.log(`${username}: ตั้งรหัสแล้ว (hash ยาว ${hash.length} ตัว, ตรวจซ้ำ = ${ok})`);
  }
}
