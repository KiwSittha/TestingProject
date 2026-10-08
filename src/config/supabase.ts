import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is missing");
}

if (!supabaseKey) {
  throw new Error("SUPABASE_KEY is missing");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

export async function testDatabaseConnection() {
  const { error } = await supabase
    .from("users")
    .select("id")
    .limit(1);

  if (error) {
    console.error("❌ Supabase connection failed:", error.message);
    return false;
  }

  console.log("✅ Supabase database connected successfully!");
  return true;
}