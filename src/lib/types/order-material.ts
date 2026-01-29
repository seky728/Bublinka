export type MaterialAvailabilityStatus = 'ready' | 'cut_needed' | 'missing';

export interface MaterialRequirement {
  itemDefinitionId: number;
  definitionName: string;
  category: 'SHEET_MATERIAL' | 'COMPONENT' | 'OTHER';
  quantityRequired: number;
  width?: number;
  height?: number;
  status: MaterialAvailabilityStatus;
  exactCount?: number;
  largerCount?: number;
}
