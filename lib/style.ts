export type StyleState = {
  pixel: number;
  black: number;
  white: number;
  gamma: number;
  density: number;
  shimmer: number;
  drift: number;
  fit: 0 | 1;
  ink: string;
  bg: string;
};

export const STYLE_DEFAULTS: StyleState = {
  pixel: 1,
  black: 0.15,
  white: 1.3,
  gamma: 2.3,
  density: 1.0,
  shimmer: 0.85,
  drift: 0.8,
  fit: 0,
  ink: "#28c840",
  bg: "#000000",
};
