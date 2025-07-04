import { create } from 'zustand';

export interface Schedule {
  coilId: string;
  customerName: string;
  bomId: string;
  createdAt: string;
}

interface ScheduleState {
  schedules: Schedule[];
  selectedSchedule: Schedule | null;
  setSchedules: (schedules: Schedule[]) => void;
  selectSchedule: (schedule: Schedule | null) => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  schedules: [],
  selectedSchedule: null,
  setSchedules: (schedules: Schedule[]) => set({ schedules }),
  selectSchedule: (schedule: Schedule | null) => set({ selectedSchedule: schedule }),
})); 