import { useReactFlow } from '@xyflow/react';

/** The canvas point at the middle of the window, for placing new nodes in view. */
export function useViewportCenter() {
  const { screenToFlowPosition } = useReactFlow();
  return () => screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
}
