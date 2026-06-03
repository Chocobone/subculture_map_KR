export type EventType   = 'popup' | 'collab' | 'goods' | 'limited';
export type EventStatus = 'upcoming' | 'ongoing' | 'ended';
export type CrawlSource = 'ruliweb' | 'fmkorea' | 'twitter' | 'naver-cafe' | 'dcinside' | 'popga';

export interface IP {
  id:        string;
  name:      string;
  keywords:  string[];
  createdAt: string;
}

export interface Event {
  id:         string;
  ipId:       string;
  title:      string;
  type:       EventType;
  place:      string | null;
  placeUrl:   string | null;
  placeLat:   number | null;
  placeLng:   number | null;
  startDate:  string | null;
  endDate:    string | null;
  sourceUrl:  string | null;
  status:     EventStatus;
  summary:    string | null;
  createdAt:  string;
  updatedAt:  string;
}

export interface EventFilter {
  ipId?:   string;
  type?:   EventType;
  status?: EventStatus;
  page:    number;
  limit:   number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page:  number;
  limit: number;
}
