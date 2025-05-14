export let SCALE_SIZE: number = 1;

export let SCALE_DISTANCE: number = 1;

export interface MoonParam {
  id: number;
  type: string;
  name: string;
  map: string;
  radius: number;
  distanceFromPlanet: number;
  info: {
    orbitalPeriod: number;
    rotationPeriod: number;
  };
}

export interface PlanetParam {
  id: number;
  type: string;
  name: string;
  map: string;
  radius: number;
  distanceFromStar: number;
  info: {
    orbitalPeriod: number;
    rotationPeriod: number;
    axialTilt: number;
    orbitInclination: number;
  };
  moons: MoonParam[];
}

export interface StarParam {
  id: number;
  type: string;
  name: string;
  map: string;
  radius: number;
  info: any[]; // puoi definire meglio se ti serve
  planets: PlanetParam[];
}

export const CELESTIAL_BODIES: StarParam[] = [
  {
    id: 1,
    type: "star",
    name: "sun",
    map: "g",
    radius: 696340,
    info: [],
    planets: [
      {
        id: 1,
        type: "planet",
        name: "mercury",
        map: "mercury",
        radius: 2439.7,
        distanceFromStar: 57910000,
        info: {
          orbitalPeriod: 87.97,
          rotationPeriod: 58.646,
          axialTilt: 0.03,
          orbitInclination: 7.0,
        },
        moons: [],
      },
      {
        id: 2,
        type: "planet",
        name: "venus",
        map: "venus",
        radius: 6051.8,
        distanceFromStar: 108200000,
        info: {
          orbitalPeriod: 224.7,
          rotationPeriod: -243.025, // rotazione retrograda
          axialTilt: 177.36,
          orbitInclination: 3.39,
        },
        moons: [],
      },
      {
        id: 3,
        type: "planet",
        name: "earth",
        map: "earth",
        radius: 6371,
        distanceFromStar: 149600000,
        info: {
          orbitalPeriod: 365.25,
          rotationPeriod: 0.997,
          axialTilt: 23.44,
          orbitInclination: 0.0,
        },
        moons: [
          {
            id: 1,
            type: "moon",
            name: "moon",
            map: "moon",
            radius: 1737,
            distanceFromPlanet: 384400,
            info: {
              orbitalPeriod: 27.3,
              rotationPeriod: 27.3,
            },
          },
        ],
      },
      {
        id: 4,
        type: "planet",
        name: "mars",
        map: "mars",
        radius: 3389.5,
        distanceFromStar: 227900000,
        info: {
          orbitalPeriod: 687,
          rotationPeriod: 1.03,
          axialTilt: 25.19,
          orbitInclination: 1.85,
        },
        moons: [
          {
            id: 1,
            type: "moon",
            name: "phobos",
            map: "phobos",
            radius: 11.267,
            distanceFromPlanet: 9376,
            info: {
              orbitalPeriod: 0.319,
              rotationPeriod: 0.319,
            },
          },
          {
            id: 2,
            type: "moon",
            name: "deimos",
            map: "deimos",
            radius: 6.2,
            distanceFromPlanet: 23463,
            info: {
              orbitalPeriod: 1.263,
              rotationPeriod: 1.263,
            },
          },
        ],
      },
      {
        id: 5,
        type: "planet",
        name: "jupiter",
        map: "jupiter",
        radius: 69911,
        distanceFromStar: 778500000,
        info: {
          orbitalPeriod: 4331,
          rotationPeriod: 0.4135,
          axialTilt: 3.13,
          orbitInclination: 1.31,
        },
        moons: [],
      },
      {
        id: 6,
        type: "planet",
        name: "saturn",
        map: "saturn",
        radius: 58232,
        distanceFromStar: 1433000000,
        info: {
          orbitalPeriod: 10747,
          rotationPeriod: 0.444,
          axialTilt: 26.73,
          orbitInclination: 2.49,
        },
        moons: [],
      },
      {
        id: 7,
        type: "planet",
        name: "uranus",
        map: "uranus",
        radius: 25362,
        distanceFromStar: 2871000000,
        info: {
          orbitalPeriod: 30589,
          rotationPeriod: -0.718,
          axialTilt: 97.77,
          orbitInclination: 0.77,
        },
        moons: [],
      },
      {
        id: 8,
        type: "planet",
        name: "neptune",
        map: "neptune",
        radius: 24622,
        distanceFromStar: 4495000000,
        info: {
          orbitalPeriod: 59800,
          rotationPeriod: 0.671,
          axialTilt: 28.32,
          orbitInclination: 1.77,
        },
        moons: [],
      },
    ],
  },
];
