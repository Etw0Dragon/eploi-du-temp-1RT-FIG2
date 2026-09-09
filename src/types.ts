export type CalendarGroup = {
  id: string;
  label: string;
  icsUrl: string;
};

export type ScheduleEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  details: string[];
  allDay: boolean;
};

export type ScheduleResponse = {
  group: Pick<CalendarGroup, "id" | "label">;
  events: ScheduleEvent[];
  fetchedAt: string;
  stale: boolean;
};
