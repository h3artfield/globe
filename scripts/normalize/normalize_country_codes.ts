import { MVP_COUNTRIES } from "@/lib/pipeline/constants";

const invalidCodes = MVP_COUNTRIES.filter((countryCode) => !/^[A-Z]{3}$/.test(countryCode));

if (invalidCodes.length > 0) {
  console.error(`Invalid ISO Alpha-3 codes: ${invalidCodes.join(", ")}`);
  process.exit(1);
}

console.log(`Validated ${MVP_COUNTRIES.length} MVP ISO Alpha-3 country codes.`);
