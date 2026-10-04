export interface Question {
  id: string; // The document ID from Firestore
  qIndex?: number; // --- *** NEW: ADDED FOR NUMERICAL SORTING *** ---
  title: string;
  subject: string;
  topic: string;
  question_html: string;
  question_image_links?: string[];
  explanation_html: string;
  explanation_image_links?: string[];
  explanation_redirect_url?: string | null; // For External Resource links
  options: {
    label: string;
    text_html: string;
    is_correct: boolean;
  }[];
  correctAnswerLabel?: string | null; // For MCQ
  // difficulty: 'Easy' | 'Medium' | 'Hard'; // REMOVED: No longer in use
  year: string;
  source?: string;
  createdAt?: string;
  tags: string[];
  accuracy?: number;
  attempts?: number;
  correctCount?: number; // Global: how many users got this right
  question_type: 'mcq';
  verified: boolean;
  addedBy?: string;
  section: string; // To know which section this question belongs to
  randomId?: number; // Required for O(1) random sampling at scale
}

// --- NEW: Branch-specific stat sub-types ---
export interface UserStats {
  attempted: number;
  correct: number;
  accuracy: number;
  // Pre-calculated map of { [subjectName]: count }
  subjects: Record<string, number>;
}

export interface UserStreakData {
  currentStreak: number;
  lastSubmissionDate: string; // ISO date string 'YYYY-MM-DD'
}

// Represents the data structure in the 'users/{uid}' document
export interface User {
  uid: string;
  name: string;
  username: string;
  email: string;
  joined: string;
  avatar?: string;
  role?: 'admin' | 'moderator' | 'user';
  needsSetup?: boolean;

// --- NEW: Section-keyed objects ---
  // e.g., { A: 1500, B: 1450 }
  ratings: Record<string, number>;

  // e.g., { A: { attempted: 10, ... }, B: { attempted: 5, ... } }
  sectionStats: Record<string, UserStats>;

  // e.g., { A: { '2024-01-01': 5, ... }, B: { ... } }
  sectionActivityCalendar: Record<string, Record<string, number>>;

  // e.g., { A: { currentStreak: 5, ... }, B: { ... } }
  sectionStreakData: Record<string, UserStreakData>;

  // --- NEW: Section-specific rating history ---
  sectionRatings?: Record<string, number>;
  sectionRatingHistory?: Record<string, any[]>;
  highestSectionRatings?: Record<string, number>;

  // DEPRECATED: Old global stats (we'll migrate away from these)
  stats?: {
    attempted: number;
    correct: number;
    accuracy: number;
    subjects?: Record<string, number>;
  };
  activityCalendar?: Record<string, number>;
  streakData?: {
    currentStreak: number;
    lastSubmissionDate: string;
  };
  rating?: number;
  ratingHistory?: any[]; // Array of { contestId, oldRating, newRating, ... }
  highestRating?: number;
}

// Represents a document in 'users/{uid}/submissions'
export interface Submission {
  qid: string;
  uid: string;
  correct: boolean;
  timestamp: string; // ISO string
  selectedOptions: string[]; // Always an array
  timeTaken?: number;
  section: string; // --- NEW: Record which section this submission was for ---
  questionTitle?: string; // --- NEW: Denormalized question title for UI rendering ---
}

// Represents a document in 'users/{uid}/userQuestionData'
export interface UserQuestionData {
  isFavorite?: boolean;
  note?: string;
  savedListIds?: string[];
}

// Represents a document in 'users/{uid}/questionLists'
export interface QuestionList {
  id: string; // Firestore document ID
  uid: string; // Owner's UID
  name: string;
  questionIds: string[]; // Array of question IDs
  createdAt: string; // ISO string or Firestore Timestamp
  isPrivate?: boolean;
}
