export interface CrewMember {
  name: string;
  role: string;
  flag?: string;
}

export interface MissionPhase {
  name: string;
  startMET: number;
}

export interface MissionConfig {
  id: string;
  name: string;
  horizonsId: string;
  startDate: Date;
  endDate: Date;
  crew: CrewMember[];
  youtubeVideoId: string;
  phases: MissionPhase[];
  modelPath: string;
  queryParam: string;
}

export const ARTEMIS_2: MissionConfig = {
  id: "artemis-2",
  name: "ARTEMIS II",
  horizonsId: "-1024",
  startDate: new Date("2026-04-01T22:35:12Z"),
  endDate: new Date("2026-04-11T02:00:00Z"),
  crew: [
    { name: "Reid Wiseman", role: "CDR", flag: "🇺🇸" },
    { name: "Victor Glover", role: "PLT", flag: "🇺🇸" },
    { name: "Christina Koch", role: "MS1", flag: "🇺🇸" },
    { name: "Jeremy Hansen", role: "MS2", flag: "🇨🇦" },
  ],
  youtubeVideoId: "6RwfNBtepa4",
  phases: [
    { name: "LAUNCH & ASCENT", startMET: 0 },
    { name: "TRANS-LUNAR INJECTION", startMET: 90000 },
    { name: "TRANS-LUNAR COAST", startMET: 93600 },
    { name: "LUNAR FLYBY", startMET: 436000 },
    { name: "RETURN TRANSIT", startMET: 520000 },
    { name: "ENTRY & SPLASHDOWN", startMET: 820000 },
  ],
  modelPath: "/models/orion.glb",
  queryParam: "artemis",
};

export function getActiveMission(): MissionConfig | null {
  const now = Date.now();
  if (now >= ARTEMIS_2.startDate.getTime() && now <= ARTEMIS_2.endDate.getTime()) {
    return ARTEMIS_2;
  }
  return null;
}
