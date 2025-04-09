export interface DailyProgressEntry {
  dateString: string;
  timestamp: number;
  ageInDays: number;
  averageWeight: number;
  deaths: number;
  feedAmount: number;
  feedType: string;
  waterStatus: 'OK' | 'NOT OK';
  notes: string;
  quantity: number;
  manualUpdate: boolean;
  autoBackfilled?: boolean;
} 