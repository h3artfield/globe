import type { ManualRecord } from "@/lib/sources/tabularParser";
import {
  buildCowSourceId,
  deriveAllianceEventType,
  resolveCowEventType,
  transformCorrelatesOfWar,
} from "@/lib/kb/batch1Transform/cowTransform";
import { isAllianceEvent } from "@/lib/worldModel/relationshipRagHydration";
import type { WorldEvent } from "@/types/worldModel";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const allianceRecord: ManualRecord = {
  version4id: "9001",
  ccode1: "365",
  ccode2: "640",
  state_name1: "Russia",
  state_name2: "Turkey",
  dyad_st_year: "1952",
  dyad_st_month: "2",
  dyad_st_day: "18",
  defense: "1",
  neutrality: "0",
  nonaggression: "0",
  entente: "0",
};

const warRecord: ManualRecord = {
  warnum: "522",
  ccode1: "750",
  ccode2: "770",
  wartype: "1",
  warname: "Indo-Pakistani War",
  startyear1: "1965",
  startmonth1: "8",
  startday1: "5",
};

const result = transformCorrelatesOfWar(
  [allianceRecord, warRecord],
  ["smoke/fixture.csv"],
  "data/manual_imports/correlates_of_war/cow_alliances_wars.csv",
);

assert(result.rows.length === 2, `expected 2 transformed rows, got ${result.rows.length}`);
assert(
  result.rows.some((row) => row.event_type === "defense_pact" && row.source_id === "9001:defense_pact"),
  "alliance row should derive defense_pact and version4id subtype source_id",
);
assert(
  result.rows.some((row) => row.event_type === "1" && row.country_codes === "IND|PAK"),
  "war row should preserve wartype and IND|PAK dyad",
);

assert(deriveAllianceEventType(allianceRecord) === "defense_pact", "deriveAllianceEventType failed");
assert(resolveCowEventType(warRecord) === "1", "resolveCowEventType should read wartype");
assert(buildCowSourceId(allianceRecord, "defense_pact") === "9001:defense_pact", "buildCowSourceId failed");

const allianceEvent: WorldEvent = {
  event_id: "correlates_of_war:9001:defense_pact",
  event_date: "1952-02-18",
  year: 1952,
  country_codes: ["RUS", "TUR"],
  relationship_id: null,
  event_type: "defense_pact",
  event_category: "foreign_policy",
  headline: "defense_pact",
  summary: "",
  actors: [],
  locations: [],
  importance_score: null,
  domestic_impact_score: null,
  international_impact_score: null,
  economic_impact_score: null,
  security_impact_score: null,
  regime_impact_score: null,
  long_term_importance: "medium",
  source_ids: ["9001:defense_pact", "correlates_of_war"],
  claim_type: "fact",
  confidence: "unknown",
  notes: "",
};

assert(isAllianceEvent(allianceEvent), "isAllianceEvent should recognize defense_pact");

console.log("smoke_cow_transform: PASS");
