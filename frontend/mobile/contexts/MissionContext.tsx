import {
  PropsWithChildren,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';

import { mockTodayChallenge, mockUserProfile } from '@/constants/mockAiResult';

type MissionContextValue = {
  isTodayMissionCompleted: boolean;
  currentXp: number;
  currentLevel: number;
  currentStreak: number;
  weeklyCompletedCount: number;
  completeTodayMission: () => void;
  resetTodayMission: () => void;
};

const MissionContext = createContext<MissionContextValue | null>(null);

const BASE_STREAK = 2;
const BASE_WEEKLY_COMPLETED_COUNT = 3;
const LEVEL_GOAL = 200;

export function MissionProvider({ children }: PropsWithChildren) {
  const [isTodayMissionCompleted, setIsTodayMissionCompleted] = useState(false);
  const [currentXp, setCurrentXp] = useState(mockUserProfile.total_xp);
  const [currentLevel, setCurrentLevel] = useState(mockUserProfile.current_level);
  const [currentStreak, setCurrentStreak] = useState(BASE_STREAK);
  const [weeklyCompletedCount, setWeeklyCompletedCount] = useState(
    BASE_WEEKLY_COMPLETED_COUNT
  );

  const completeTodayMission = () => {
    if (isTodayMissionCompleted) return;

    const nextXp = currentXp + mockTodayChallenge.xp_reward;

    setIsTodayMissionCompleted(true);
    setCurrentXp(nextXp);
    setCurrentStreak((prev) => prev + 1);
    setWeeklyCompletedCount((prev) => prev + 1);

    if (nextXp >= LEVEL_GOAL && currentLevel === mockUserProfile.current_level) {
      setCurrentLevel((prev) => prev + 1);
    }
  };

  const resetTodayMission = () => {
    setIsTodayMissionCompleted(false);
    setCurrentXp(mockUserProfile.total_xp);
    setCurrentLevel(mockUserProfile.current_level);
    setCurrentStreak(BASE_STREAK);
    setWeeklyCompletedCount(BASE_WEEKLY_COMPLETED_COUNT);
  };

  const value = useMemo(
    () => ({
      isTodayMissionCompleted,
      currentXp,
      currentLevel,
      currentStreak,
      weeklyCompletedCount,
      completeTodayMission,
      resetTodayMission,
    }),
    [
      currentLevel,
      currentStreak,
      currentXp,
      isTodayMissionCompleted,
      weeklyCompletedCount,
    ]
  );

  return (
    <MissionContext.Provider value={value}>
      {children}
    </MissionContext.Provider>
  );
}

export function useMission() {
  const context = useContext(MissionContext);

  if (!context) {
    throw new Error('useMission must be used inside MissionProvider');
  }

  return context;
}