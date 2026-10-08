const bcrypt = require("bcrypt");

async function main() {
  const hash = await bcrypt.hash("254717", 10);
  console.log(hash);
}

main();