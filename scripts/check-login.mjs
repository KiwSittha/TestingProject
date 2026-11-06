// เช็กว่าทำไม login บัญชีทดสอบไม่ผ่าน: ใช้ .env และไลบรารีเดียวกับ backend
// รัน: node scripts/check-login.mjs
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY ?? '';

// บอกชนิดของ key โดยไม่พิมพ์ตัว key ออกมา
function keyKind(k) {
  if (k.startsWith('sb_secret_')) return 'secret (ผ่าน RLS ได้)';
  if (k.startsWith('sb_publishable_')) return 'publishable (ถูก RLS บังได้)';
  try {
    const role = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).role;
    return role === 'service_role' ? 'service_role (ผ่าน RLS ได้)' : `${role} (ถูก RLS บังได้)`;
  } catch {
    return 'อ่านชนิดไม่ได้';
  }
}

const accounts = {
  cus_normal: process.env.TEST_PASSWORD_CUS_NORMAL ?? process.env.TEST_PASSWORD,
  cus_prime: process.env.TEST_PASSWORD_CUS_PRIME ?? process.env.TEST_PASSWORD,
  admin01: process.env.TEST_PASSWORD_ADMIN01 ?? process.env.TEST_PASSWORD,
};

console.log('SUPABASE_URL      =', url);
console.log('SUPABASE_KEY      =', keyKind(key));
console.log('TEST_PASSWORD     =', JSON.stringify(process.env.TEST_PASSWORD));
console.log('');

const supabase = createClient(url, key);

for (const [username, password] of Object.entries(accounts)) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, status, password_hash')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.log(`${username}: query error -> ${error.message}`);
    continue;
  }
  if (!data) {
    console.log(`${username}: ไม่พบแถว -> RLS บังอยู่ หรือ .env ชี้ไปคนละฐานข้อมูล`);
    continue;
  }

  const hash = data.password_hash ?? '';
  const match = await bcrypt.compare(password ?? '', hash).catch(() => false);
  console.log(
    `${username}: พบแถว | status = ${data.status} | hash ยาว ${hash.length} ตัว (ควรเป็น 60) | รหัสตรงกับ hash = ${match}`
  );
}
