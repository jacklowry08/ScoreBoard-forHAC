export interface District {
  id: string;
  name: string;
  shortName: string;
  baseUrl: string;
  schoolCode: string;
}

export const DISTRICTS: District[] = [
  {
    id: 'sjcs',
    name: 'St. Johns County Schools',
    shortName: 'SJCS',
    baseUrl: 'https://homeaccess.stjohns.k12.fl.us',
    schoolCode: 'pvhs_sjc',
  },
];

export const DEFAULT_DISTRICT = DISTRICTS[0];
export const DISTRICT_KEY = 'selected_district_id';
