export interface Device {
  id: number;
  room_id: number;
  name: string;
  type: string;
  status: 'ON' | 'OFF';
  current_power: number;
  daily_energy: number;
  last_active: string;
  room_name: string;
  floor_number: number;
  building_name: string;
}

export interface SummaryData {
  activeDevices: number;
  currentPowerDemand: number;
  totalEnergyToday: number;
  estimatedCost: number;
  carbonEmissions: number;
  wastePercentage: number;
}

export interface Alert {
  id: number;
  device_id: number;
  device_name: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  message: string;
  timestamp: string;
  status: 'UNREAD' | 'READ' | 'ARCHIVED';
  suggested_action: string;
}

export interface Recommendation {
  id: number;
  device_id: number;
  device_name: string;
  category: string;
  recommendation: string;
  potential_savings: number;
  timestamp: string;
}

export type Page = 'dashboard' | 'devices' | 'alerts' | 'recommendations' | 'reports' | 'settings';
