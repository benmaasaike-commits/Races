export const INDOOR_WORLD_CATALOG = {
  bedroom: {
    label: 'Bedroom',
    title: 'Indoor Beach Buggy — Bedroom',
    controlPoints: [
      [0.48, 0.018, 0.28],
      [0.50, 0.020, 0.07],
      [0.42, 0.045, -0.05],
      [0.28, 0.105, -0.10],
      [0.10, 0.155, -0.12],
      [-0.08, 0.168, -0.10],
      [-0.24, 0.135, -0.03],
      [-0.40, 0.060, 0.02],
      [-0.48, 0.028, 0.14],
      [-0.40, 0.018, 0.25],
      [-0.20, 0.022, 0.30],
      [0.04, 0.024, 0.30],
      [0.28, 0.023, 0.30],
      [0.45, 0.021, 0.30],
    ],
    sectors: [
      { id: 1, name: 'Nightstand Launch' },
      { id: 2, name: 'Bed Climb' },
      { id: 3, name: 'Pillow Drop' },
      { id: 4, name: 'Toy Shelf Sweep' },
      { id: 5, name: 'Rug Run' },
      { id: 6, name: 'Bedroom Start / Finish' },
    ],
    jumpByProgress: (p) => (p > 0.10 && p < 0.16 ? 0.95 : p > 0.43 && p < 0.48 ? 0.70 : 0),
    surfaceByProgress: (p) => {
      if (p > 0.36 && p < 0.56) return 'bed-fabric';
      if (p > 0.72 && p < 0.88) return 'wood';
      return 'plastic';
    },
  },

  living: {
    label: 'Living Room',
    title: 'Indoor Beach Buggy — Living Room',
    controlPoints: [
      [0.62, 0.018, 0.34],
      [0.64, 0.022, 0.12],
      [0.54, 0.055, -0.02],
      [0.36, 0.105, 0.05],
      [0.16, 0.12, 0.05],
      [-0.04, 0.075, -0.06],
      [-0.26, 0.045, -0.08],
      [-0.46, 0.026, 0.02],
      [-0.56, 0.024, 0.22],
      [-0.46, 0.022, 0.37],
      [-0.18, 0.022, 0.42],
      [0.12, 0.022, 0.42],
      [0.39, 0.022, 0.40],
      [0.58, 0.021, 0.36],
    ],
    sectors: [
      { id: 1, name: 'Sofa Launch' },
      { id: 2, name: 'Coffee Table Jump' },
      { id: 3, name: 'Cushion Sweep' },
      { id: 4, name: 'TV Stand Dash' },
      { id: 5, name: 'Carpet Drift' },
      { id: 6, name: 'Living Room Start / Finish' },
    ],
    jumpByProgress: (p) => (p > 0.18 && p < 0.24 ? 0.92 : p > 0.48 && p < 0.54 ? 0.65 : 0),
    surfaceByProgress: (p) => (p > 0.25 && p < 0.55 ? 'carpet' : 'wood'),
  },

  kitchen: {
    label: 'Kitchen',
    title: 'Indoor Beach Buggy — Kitchen',
    controlPoints: [
      [0.55, 0.020, 0.35],
      [0.58, 0.028, 0.14],
      [0.53, 0.065, -0.02],
      [0.39, 0.115, -0.10],
      [0.18, 0.125, -0.10],
      [-0.04, 0.085, -0.05],
      [-0.26, 0.055, 0.10],
      [-0.45, 0.026, 0.18],
      [-0.52, 0.021, 0.34],
      [-0.36, 0.020, 0.43],
      [-0.08, 0.020, 0.44],
      [0.20, 0.020, 0.43],
      [0.42, 0.020, 0.40],
      [0.54, 0.020, 0.35],
    ],
    sectors: [
      { id: 1, name: 'Tile Sprint' },
      { id: 2, name: 'Counter Climb' },
      { id: 3, name: 'Island Hairpin' },
      { id: 4, name: 'Table Jump' },
      { id: 5, name: 'Kitchen Slide' },
      { id: 6, name: 'Kitchen Start / Finish' },
    ],
    jumpByProgress: (p) => (p > 0.20 && p < 0.27 ? 0.88 : p > 0.46 && p < 0.52 ? 0.72 : 0),
    surfaceByProgress: (p) => (p > 0.22 && p < 0.44 ? 'wood' : 'tile'),
  },

  wholeHouse: {
    label: 'Whole House',
    title: 'Indoor Beach Buggy — Whole House',
    controlPoints: [
      [0.92, 0.020, 0.42],
      [0.98, 0.028, 0.18],
      [0.82, 0.055, 0.00],
      [0.62, 0.085, -0.12],
      [0.38, 0.12, -0.20],
      [0.12, 0.16, -0.18],
      [-0.16, 0.18, -0.16],
      [-0.42, 0.085, -0.10],
      [-0.68, 0.040, -0.04],
      [-0.90, 0.060, 0.08],
      [-0.96, 0.028, 0.25],
      [-0.80, 0.020, 0.44],
      [-0.50, 0.020, 0.48],
      [-0.18, 0.022, 0.48],
      [0.16, 0.022, 0.48],
      [0.46, 0.022, 0.46],
      [0.72, 0.021, 0.45],
    ],
    sectors: [
      { id: 1, name: 'Bedroom Launch' },
      { id: 2, name: 'Living Room Drop' },
      { id: 3, name: 'Sofa-to-Floor Jump' },
      { id: 4, name: 'Kitchen Counter Climb' },
      { id: 5, name: 'Whole House Sprint' },
      { id: 6, name: 'House Start / Finish' },
    ],
    jumpByProgress: (p) => (p > 0.14 && p < 0.20 ? 1.0 : p > 0.40 && p < 0.47 ? 0.90 : p > 0.67 && p < 0.73 ? 0.82 : 0),
    surfaceByProgress: (p) => {
      if (p < 0.20) return 'wood';
      if (p < 0.45) return 'carpet';
      if (p < 0.68) return 'bed-fabric';
      return 'tile';
    },
  },
};

export const INDOOR_WORLD_KEYS = Object.keys(INDOOR_WORLD_CATALOG);
