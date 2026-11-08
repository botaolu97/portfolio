import { useReactFlow } from '@xyflow/react';
import { overlayRect } from '../app/overlayRoot';

/** The canvas point at the middle of the canvas area, for placing new nodes in view. */
export function useViewportCenter() {
  const { screenToFlowPosition } = useReactFlow();
  return () => {
    const area = overlayRect();
    return screenToFlowPosition({ x: area.left + area.width / 2, y: area.top + area.height / 2 });
  };
}
