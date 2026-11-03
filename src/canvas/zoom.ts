/** Canvas zoom limits, shared by React Flow's props and the zoom guard. */
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 4;

/** Messages the demo bridge (injected into demo pages) posts to Mubu. */
export type DemoBridgeMessage =
  | { source: 'mubu-demo'; type: 'zoom'; deltaY: number; clientX: number; clientY: number }
  | { source: 'mubu-demo'; type: 'zoom-key'; key: string };

/** Pinch and ⌘-scroll: d3-zoom's rate, so every route zooms at the same speed as the canvas. */
export const wheelZoomFactor = (deltaY: number) => 2 ** (-deltaY * 0.01);
