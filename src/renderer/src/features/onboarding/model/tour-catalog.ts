// Defines stable Onborda targets and the workspace stage visited at each tour step.
import type { Step } from "onborda";

export type TourId = "empty-workspace";

export type TourItem = {
  key: string;
  selector: string;
  side: Step["side"];
};

export const TOUR_ITEMS: Record<TourId, readonly TourItem[]> = {
  "empty-workspace": [
    { key: "empty.overview", selector: "#onboarding-empty-state", side: "top" },
    { key: "empty.create", selector: "#onboarding-create-first", side: "top" },
  ],

};

export function tourItem(tour: TourId, index: number): TourItem | null {
  return TOUR_ITEMS[tour][index] ?? null;
}
