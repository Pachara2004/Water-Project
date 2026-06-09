/**
 * Thai Seawater Quality Standards
 * มาตรฐานคุณภาพน้ำทะเลของประเทศไทย
 *
 * Reference: กรมควบคุมมลพิษ (Pollution Control Department)
 * ค่ามาตรฐานคุณภาพน้ำทะเลชายฝั่ง
 */

import { LocationType } from '@prisma/client';

export interface StandardThresholds {
  phosphateMax: number;
  ammoniaMax: number;
}

export const LOCATION_STANDARDS: Record<LocationType, StandardThresholds> = {
  CONSERVATION: { phosphateMax: 0.015, ammoniaMax: 0.1 },
  CORAL_REEF: { phosphateMax: 0.015, ammoniaMax: 0.1 },
  AQUACULTURE: { phosphateMax: 0.045, ammoniaMax: 0.7 },
  RECREATION: { phosphateMax: 0.015, ammoniaMax: 0.2 },
  INDUSTRY: { phosphateMax: 0.045, ammoniaMax: 0.95 },
  COMMUNITY: { phosphateMax: 0.045, ammoniaMax: 0.95 },
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  CONSERVATION: 'เพื่อการอนุรักษ์ทรัพยากรธรรมชาติ',
  CORAL_REEF: 'เพื่อการอนุรักษ์แหล่งปะการัง',
  AQUACULTURE: 'เพื่อการเพาะเลี้ยงสัตว์น้ำ',
  RECREATION: 'เพื่อการนันทนาการ',
  INDUSTRY: 'เพื่อการอุตสาหกรรมและท่าเรือ',
  COMMUNITY: 'สำหรับเขตชุมชน',
};

export type StatusType = 'SAFE' | 'WARNING' | 'DANGER';

/**
 * Determine the status for a single parameter against its maximum threshold
 */
export function getParameterStatus(value: number | null | undefined, max: number): StatusType {
  if (value === null || value === undefined) return 'SAFE'; // Or throw error, but safe is fallback
  if (value <= max) return 'SAFE';
  return 'DANGER';
}

export interface EvaluationResult {
  phosphateStatus: StatusType;
  ammoniaStatus: StatusType;
  overallStatus: StatusType;
}

/**
 * Determine overall water quality status based on location type
 */
export function evaluateSample(
  phosphate: number | null | undefined, 
  ammonia: number | null | undefined, 
  locationType: LocationType = 'COMMUNITY'
): EvaluationResult {
  const standards = LOCATION_STANDARDS[locationType];
  
  const phosphateStatus = getParameterStatus(phosphate, standards.phosphateMax);
  const ammoniaStatus = getParameterStatus(ammonia, standards.ammoniaMax);
  
  const overallStatus = 
    (phosphateStatus === 'DANGER' || ammoniaStatus === 'DANGER') ? 'DANGER' : 'SAFE';

  return {
    phosphateStatus,
    ammoniaStatus,
    overallStatus
  };
}

/**
 * Evaluate sample against ALL standards to see which it passes
 */
export function evaluateAllStandards(
  phosphate: number | null | undefined,
  ammonia: number | null | undefined
): Record<LocationType, boolean> {
  const results = {} as Record<LocationType, boolean>;
  
  for (const [type, std] of Object.entries(LOCATION_STANDARDS)) {
    const locType = type as LocationType;
    const po4Safe = getParameterStatus(phosphate, std.phosphateMax) === 'SAFE';
    const nh3Safe = getParameterStatus(ammonia, std.ammoniaMax) === 'SAFE';
    results[locType] = po4Safe && nh3Safe;
  }
  
  return results;
}

/**
 * Get Thai label for status
 */
export function getStatusLabel(status: StatusType): string {
  const labels: Record<StatusType, string> = {
    SAFE: 'ปลอดภัย',
    WARNING: 'เฝ้าระวัง',
    DANGER: 'อันตราย',
  };
  return labels[status];
}

/**
 * Get organization Thai label
 */
export function getOrganizationLabel(org: string): string {
  const labels: Record<string, string> = {
    FISHERY: 'กรมประมง',
    POLLUTION: 'กรมควบคุมมลพิษ',
    OTHER: 'อื่นๆ',
  };
  return labels[org] || org;
}
