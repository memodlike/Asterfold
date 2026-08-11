export interface SemanticPalette {
  canvas: string;
  surface: string;
  surfaceSolid: string;
  surfaceElevated: string;
  text: string;
  secondary: string;
  border: string;
  danger: string;
  success: string;
  shadow: string;
}

const LIGHT_PALETTE: SemanticPalette = {
  canvas: "#f1f2f4",
  surface: "255 255 255",
  surfaceSolid: "#fbfbfc",
  surfaceElevated: "#ffffff",
  text: "#191a1d",
  secondary: "#6e7077",
  border: "19 20 23",
  danger: "#c9342f",
  success: "#237c4b",
  shadow: "0 20px 55px rgb(20 22 28 / .12)",
};

const DARK_PALETTE: SemanticPalette = {
  canvas: "#16171a",
  surface: "38 40 44",
  surfaceSolid: "#25272b",
  surfaceElevated: "#2d2f34",
  text: "#f5f5f6",
  secondary: "#a1a3aa",
  border: "255 255 255",
  danger: "#ff7772",
  success: "#64d79b",
  shadow: "0 24px 64px rgb(0 0 0 / .34)",
};

export function semanticPalette(dark: boolean): SemanticPalette {
  return dark ? DARK_PALETTE : LIGHT_PALETTE;
}
