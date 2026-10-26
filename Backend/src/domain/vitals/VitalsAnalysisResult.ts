export type VitalsStatus = 'normal' | 'warning' | 'critical';

export class VitalsAnalysisResult {
  constructor(
    public readonly status: VitalsStatus,
    public readonly flaggedParams: string[],
    public readonly message: string
  ) {}
}
