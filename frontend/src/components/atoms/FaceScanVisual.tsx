import React from 'react';
import { FaceScanModel } from '../pages/FaceScanModel';
import type { FaceScanModelProps } from '../pages/FaceScanModel';

export type FaceScanVisualProps = FaceScanModelProps;
export const FaceScanVisual: React.FC<FaceScanVisualProps> = (props) => <FaceScanModel {...props} />;
export default FaceScanVisual;
