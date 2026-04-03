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
  startDate: new Date("2026-04-02T01:59:00Z"),
  endDate: new Date("2026-04-11T00:02:00Z"),
  crew: [
    { name: "Reid Wiseman", role: "CDR" },
    { name: "Victor Glover", role: "PLT" },
    { name: "Christina Koch", role: "MS1" },
    { name: "Jeremy Hansen", role: "MS2", flag: "🇨🇦" },
  ],
  youtubeVideoId: "6RwfNBtepa4",
  phases: [
    { name: "LAUNCH & ASCENT", startMET: 0 },
    { name: "TRANS-LUNAR INJECTION", startMET: 12600 },
    { name: "TRANS-LUNAR COAST", startMET: 14400 },
    { name: "LUNAR FLYBY", startMET: 345600 },
    { name: "RETURN TRANSIT", startMET: 432000 },
    { name: "ENTRY & SPLASHDOWN", startMET: 777600 },
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
