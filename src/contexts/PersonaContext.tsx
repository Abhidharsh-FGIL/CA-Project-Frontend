import React, { createContext, useContext, useMemo } from 'react';
import type { PersonaBand } from '@/types';

export interface PersonaConfig {
  band: PersonaBand;
  grade: number;
  tone: 'playful' | 'encouraging' | 'balanced' | 'professional' | 'academic';
  progressStyle: 'stars' | 'quests' | 'xp' | 'mastery' | 'academic';
  achievementStyle: 'stickers' | 'badges' | 'trophies' | 'certificates' | 'honors';
  labels: {
    xp: string;
    streak: string;
    progress: string;
    achievement: string;
    complete: string;
    keepGoing: string;
  };
}

const personaConfigs: Record<PersonaBand, Omit<PersonaConfig, 'band' | 'grade'>> = {
  A: {
    tone: 'playful',
    progressStyle: 'stars',
    achievementStyle: 'stickers',
    labels: {
      xp: 'Stars',
      streak: 'Sunny Days',
      progress: 'My Journey',
      achievement: 'Stickers',
      complete: 'Hooray! 🎉',
      keepGoing: 'You can do it! ⭐',
    },
  },
  B: {
    tone: 'encouraging',
    progressStyle: 'quests',
    achievementStyle: 'badges',
    labels: {
      xp: 'Points',
      streak: 'Streak',
      progress: 'Quest Map',
      achievement: 'Badges',
      complete: 'Quest Complete! 🏆',
      keepGoing: 'Keep exploring! 🗺️',
    },
  },
  C: {
    tone: 'balanced',
    progressStyle: 'xp',
    achievementStyle: 'trophies',
    labels: {
      xp: 'XP',
      streak: 'Day Streak',
      progress: 'Progress',
      achievement: 'Achievements',
      complete: 'Well done!',
      keepGoing: 'Keep pushing!',
    },
  },
  D: {
    tone: 'professional',
    progressStyle: 'mastery',
    achievementStyle: 'certificates',
    labels: {
      xp: 'Points',
      streak: 'Consistency',
      progress: 'Skill Mastery',
      achievement: 'Milestones',
      complete: 'Skill Mastered',
      keepGoing: 'Continue building mastery',
    },
  },
  E: {
    tone: 'academic',
    progressStyle: 'academic',
    achievementStyle: 'honors',
    labels: {
      xp: 'Credits',
      streak: 'Study Streak',
      progress: 'Academic Progress',
      achievement: 'Honors',
      complete: 'Objective Achieved',
      keepGoing: 'Stay focused on your goals',
    },
  },
};

function getPersonaBand(grade: number): PersonaBand {
  if (grade <= 2) return 'A';
  if (grade <= 5) return 'B';
  if (grade <= 8) return 'C';
  if (grade <= 10) return 'D';
  return 'E';
}

interface PersonaContextValue {
  persona: PersonaConfig;
  updateGrade: (grade: number) => void;
}

const PersonaContext = createContext<PersonaContextValue | undefined>(undefined);

interface PersonaProviderProps {
  children: React.ReactNode;
  grade?: number;
}

export function PersonaProvider({ children, grade = 10 }: PersonaProviderProps) {
  const [currentGrade, setCurrentGrade] = React.useState(grade);

  const persona = useMemo<PersonaConfig>(() => {
    const band = getPersonaBand(currentGrade);
    return {
      band,
      grade: currentGrade,
      ...personaConfigs[band],
    };
  }, [currentGrade]);

  const updateGrade = (newGrade: number) => {
    setCurrentGrade(Math.max(1, Math.min(12, newGrade)));
  };

  return (
    <PersonaContext.Provider value={{ persona, updateGrade }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within PersonaProvider');
  }
  return context;
}
