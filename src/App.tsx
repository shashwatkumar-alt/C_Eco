import React, { useState } from 'react';
import { useQuizStore } from './lib/store';
import { Play, Shuffle, Settings, Trash2, Clock, CheckCircle, XCircle, Sun, Moon, FastForward, Menu, X, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Question } from './lib/types';
import { cn } from './lib/utils';
import { preloadedQuestions as economicsQuestions } from './data';
import { conservationGeographyQuestions as geographyQuestions } from './data-geography';

type Subject = 'geography' | 'economics';
type AppView = 'dashboard' | 'active' | 'review' | 'results';

function App() {
  const { setQuestions, preferences, setPreferences, clearQuestions } = useQuizStore();
  const [selectedSubject, setSelectedSubject] = useState<Subject>('geography');
  const [activeQuiz, setActiveQuiz] = useState<Question[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(45);
  const [view, setView] = useState<AppView>('dashboard');
  const [isNavOpen, setIsNavOpen] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState<string>('All');

  const currentSubjectQuestions = selectedSubject === 'geography' ? geographyQuestions : economicsQuestions;

  React.useEffect(() => {
    // Force loaded data over stale DB defaults to capture any code-side corrections
    setQuestions(currentSubjectQuestions);
  }, [selectedSubject]);

  // Apply dark mode class to html element
  React.useEffect(() => {
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [preferences.theme]);

  const handleSubjectChange = (subject: Subject) => {
    setSelectedSubject(subject);
    setSelectedWeek('All');
  };

  const availableWeeks = React.useMemo(() => {
    const weeks = [...new Set(currentSubjectQuestions.map(q => q.weekId))];
    return weeks.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      return numA - numB;
    });
  }, [currentSubjectQuestions]);

  // Shuffle option order for a question, remapping the correct answer key
  const shuffleOptions = (q: Question): Question => {
    const keys = ['A', 'B', 'C', 'D'] as const;
    const entries = keys.map(k => ({ key: k, val: q.options[k] }));
    // Fisher-Yates shuffle
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    const newOptions: Record<string, string> = {};
    let newCorrect = q.correctAnswer;
    keys.forEach((newKey, idx) => {
      newOptions[newKey] = entries[idx].val;
      if (entries[idx].key === q.correctAnswer) {
        newCorrect = newKey;
      }
    });
    return { ...q, options: newOptions as Question['options'], correctAnswer: newCorrect };
  };

  const autoAdvanceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoAdvanceTimer = () => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => clearAutoAdvanceTimer();
  }, [currentIndex, activeQuiz, view]);

  const startQuiz = () => {
    clearAutoAdvanceTimer();
    let qToPlay: Question[] = currentSubjectQuestions.map(shuffleOptions);
    if (selectedWeek !== 'All') {
      qToPlay = qToPlay.filter(q => q.weekId === selectedWeek);
    }
    if (preferences.randomize) {
      qToPlay = [...qToPlay].sort(() => Math.random() - 0.5);
    }
    setActiveQuiz(qToPlay);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setTimeLeft(45);
    setView('active');
    setIsNavOpen(false);
  };

  React.useEffect(() => {
    if (!activeQuiz || view !== 'active' || !preferences.isTimerEnabled) return;
    
    if (timeLeft <= 0) {
      clearAutoAdvanceTimer();
      if (currentIndex === activeQuiz.length - 1) {
        finishQuiz();
      } else {
        setCurrentIndex(c => c + 1);
        setTimeLeft(45);
      }
      return;
    }

    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [activeQuiz, view, timeLeft, currentIndex, preferences.isTimerEnabled]);

  // In review mode → show review screen; in immediate mode → show results
  const finishQuiz = () => {
    clearAutoAdvanceTimer();
    if (preferences.feedbackMode === 'review') {
      setView('review');
      setCurrentIndex(0);
    } else {
      setView('results');
    }
    setIsNavOpen(false);
  };

  const submitFinal = () => {
    setView('results');
    setIsNavOpen(false);
  };

  const handleJumpToQuestion = (targetIndex: number) => {
    clearAutoAdvanceTimer();
    setCurrentIndex(targetIndex);
    setTimeLeft(45);
    setIsNavOpen(false);
  };

  const handleAnswerSelect = (opt: string) => {
    if (!activeQuiz) return;
    const qId = activeQuiz[currentIndex].id;
    const isAutoNext = preferences.isAutoNextEnabled ?? true;

    // In immediate mode: once an answer is revealed, prevent re-selecting
    if (preferences.feedbackMode === 'immediate' && selectedAnswers[qId]) return;

    // If user taps the already-selected option → re-confirm, trigger auto-next
    if (selectedAnswers[qId] === opt) {
      if (isAutoNext && !autoAdvanceTimeoutRef.current) {
        clearAutoAdvanceTimer();
        const delay = preferences.feedbackMode === 'immediate' ? 350 : 100;
        autoAdvanceTimeoutRef.current = setTimeout(() => {
          if (currentIndex === activeQuiz.length - 1) {
            finishQuiz();
          } else {
            setCurrentIndex(c => c + 1);
            setTimeLeft(45);
          }
        }, delay);
      }
      return;
    }
    
    setSelectedAnswers(prev => ({ ...prev, [qId]: opt }));
    
    if (isAutoNext) {
      clearAutoAdvanceTimer();
      const delay = preferences.feedbackMode === 'immediate' ? 350 : 100;
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        if (currentIndex === activeQuiz.length - 1) {
          finishQuiz();
        } else {
          setCurrentIndex(c => c + 1);
          setTimeLeft(45);
        }
      }, delay);
    }
  };

  // Answer change handler for review screen (before final submit)
  const handleReviewAnswerChange = (opt: string) => {
    if (!activeQuiz) return;
    const qId = activeQuiz[currentIndex].id;
    setSelectedAnswers(prev => ({ ...prev, [qId]: opt }));
  };

  // ─── RESULTS SCREEN ───────────────────────────────────────────────────────
  if (activeQuiz && view === 'results') {
    const correctCount = activeQuiz.filter(q => selectedAnswers[q.id] === q.correctAnswer).length;
    const incorrectQuestions = activeQuiz.filter(q => selectedAnswers[q.id] !== q.correctAnswer);
    const pct = Math.round((correctCount / activeQuiz.length) * 100);

    return (
      <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-900 flex flex-col items-center p-3 sm:p-8 transition-colors overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="p-5 sm:p-8 bg-white dark:bg-slate-800 shadow-xl rounded-2xl sm:rounded-3xl max-w-2xl w-full text-center transition-colors mb-4 sm:mb-6 mt-2">
          <p className="text-xs uppercase tracking-wider font-bold text-primary mb-2">
            {selectedSubject === 'geography' ? 'Conservation Geography' : 'Conservation Economics'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4 sm:mb-6">Quiz Results</h2>
          <div className={cn("text-5xl sm:text-6xl font-black mb-3", pct >= 70 ? "text-green-500" : pct >= 40 ? "text-amber-500" : "text-red-500")}>{pct}%</div>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-6">{correctCount} out of {activeQuiz.length} correct</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => { setView('dashboard'); setActiveQuiz(null); }} className="w-full sm:w-auto bg-primary text-white px-6 py-3.5 rounded-xl font-bold hover:bg-primary-hover transition shadow-md active:scale-95 cursor-pointer">Back to Dashboard</button>
            <button onClick={() => { setView('review'); setCurrentIndex(0); }} className="w-full sm:w-auto border-2 border-primary text-primary px-6 py-3.5 rounded-xl font-bold hover:bg-primary/5 transition active:scale-95 cursor-pointer">Review Answers</button>
          </div>
        </motion.div>

        {incorrectQuestions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="max-w-2xl w-full space-y-3 sm:space-y-4 pb-10">
            <h3 className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 sm:mb-4 px-1">Incorrectly Answered</h3>
            {incorrectQuestions.map((q, idx) => (
              <div key={q.id} className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-sm border border-red-100 dark:border-red-900/30 text-left">
                <h4 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex gap-2.5">
                  <span className="text-red-500 font-bold block flex-shrink-0">{idx + 1}.</span> {q.questionText}
                </h4>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-red-600 dark:text-red-400 mt-0.5 whitespace-nowrap">Your Answer:</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {selectedAnswers[q.id] ? q.options[selectedAnswers[q.id] as keyof typeof q.options] : "Not answered"}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-green-600 dark:text-green-400 mt-0.5 whitespace-nowrap">Correct Answer:</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {q.options[q.correctAnswer as keyof typeof q.options]}
                    </span>
                  </div>
                </div>
                {q.explanation && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-blue-300 rounded-xl text-xs sm:text-sm leading-relaxed">
                    {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>
    );
  }

  // ─── REVIEW SCREEN (pre-submit, navigate & change answers) ────────────────
  if (activeQuiz && view === 'review') {
    const question = activeQuiz[currentIndex];
    const selectedOpt = selectedAnswers[question.id];
    const answeredCount = Object.keys(selectedAnswers).length;

    return (
      <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-900 flex flex-col items-center transition-colors">
        {/* Top Bar */}
        <div className="w-full max-w-2xl px-3 pt-3 sm:px-6 sm:pt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNavOpen(prev => !prev)}
                className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-primary flex items-center gap-2 active:scale-95 transition cursor-pointer"
              >
                <Menu size={18} />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Q.{currentIndex + 1}<span className="text-slate-400 font-normal">/{activeQuiz.length}</span>
                </span>
              </button>
              <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Review Mode
              </span>
            </div>
            <button
              onClick={() => setPreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })}
              className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-95 transition cursor-pointer"
            >
              {preferences.theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* Scrollable question number strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {activeQuiz.map((q, idx) => {
              const isAns = !!selectedAnswers[q.id];
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => { clearAutoAdvanceTimer(); setCurrentIndex(idx); }}
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-lg text-xs font-bold border transition-all active:scale-95 cursor-pointer",
                    isCurrent
                      ? "bg-primary text-white border-primary shadow ring-2 ring-primary/30 scale-110"
                      : isAns
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                      : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                  )}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigator Modal */}
        <AnimatePresence>
          {isNavOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsNavOpen(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-10 flex flex-col max-h-[80vh] overflow-hidden"
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Question Navigator</h3>
                    <p className="text-xs text-slate-500">{answeredCount} of {activeQuiz.length} answered</p>
                  </div>
                  <button onClick={() => setIsNavOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer"><X size={20} /></button>
                </div>
                <div className="p-4 overflow-y-auto grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {activeQuiz.map((q, idx) => {
                    const isAns = !!selectedAnswers[q.id];
                    const isCurrent = idx === currentIndex;
                    return (
                      <button
                        key={q.id}
                        onClick={() => { setCurrentIndex(idx); setIsNavOpen(false); }}
                        className={cn(
                          "h-10 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer",
                          isCurrent ? "bg-primary text-white border-primary shadow ring-2 ring-primary/30" : isAns ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700" : "bg-slate-50 dark:bg-slate-900/60 text-slate-500 border-slate-200 dark:border-slate-700"
                        )}
                      >{idx + 1}</button>
                    );
                  })}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center text-xs text-slate-500">Tap any number to jump</div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Question Card */}
        <div className="w-full max-w-2xl px-3 pb-3 sm:px-6 sm:pb-6 flex-1 flex flex-col mt-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="bg-white dark:bg-slate-800 p-4 sm:p-7 rounded-2xl shadow-lg flex flex-col relative overflow-hidden transition-colors"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5 block">
                Question {currentIndex + 1} of {activeQuiz.length}
              </span>
              <h3 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug mb-4 sm:mb-6">
                {question.questionText}
              </h3>
              <div className="space-y-2.5 sm:space-y-3">
                {Object.entries(question.options).map(([key, val]) => {
                  const isSelected = selectedOpt === key;
                  let bgClass = "bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700";
                  if (isSelected) bgClass = "bg-primary/10 border-primary text-primary-hover dark:text-primary";
                  return (
                    <button
                      key={key}
                      onClick={() => handleReviewAnswerChange(key)}
                      className={cn(
                        "w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-colors duration-100 active:scale-[0.98] flex items-center justify-between font-medium text-sm sm:text-base min-h-[46px] dark:text-slate-200 cursor-pointer",
                        bgClass
                      )}
                    >
                      <span className="flex items-center gap-3 flex-1">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm text-slate-600 dark:text-slate-300 text-xs font-bold flex-shrink-0">{key}</span>
                        <span className="leading-snug">{val}</span>
                      </span>
                      {isSelected && <CheckCircle size={18} className="text-primary flex-shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
              {!selectedOpt && <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-medium text-center">Tap an option to answer this question</p>}
            </motion.div>
          </AnimatePresence>

          {/* Bottom Controls */}
          <div className="flex justify-between items-center mt-3 gap-2">
            <button
              onClick={() => { clearAutoAdvanceTimer(); setCurrentIndex(c => Math.max(0, c - 1)); }}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 font-semibold text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl disabled:opacity-40 transition-colors active:scale-95 cursor-pointer"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            {currentIndex === activeQuiz.length - 1 ? (
              <button
                onClick={submitFinal}
                className="flex items-center gap-2 px-5 py-2.5 sm:px-8 sm:py-3 font-bold text-xs sm:text-sm bg-primary text-white hover:bg-primary-hover rounded-xl shadow-md transition-colors active:scale-95 cursor-pointer"
              >
                <Send size={15} /> Submit
              </button>
            ) : (
              <button
                onClick={() => { clearAutoAdvanceTimer(); setCurrentIndex(c => Math.min(activeQuiz.length - 1, c + 1)); }}
                className="flex items-center gap-1.5 px-5 py-2.5 sm:px-8 sm:py-3 font-bold text-xs sm:text-sm bg-primary text-white hover:bg-primary-hover rounded-xl shadow-md transition-colors active:scale-95 cursor-pointer"
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>

          {answeredCount < activeQuiz.length && (
            <div className="mt-3 flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                {activeQuiz.length - answeredCount} question{activeQuiz.length - answeredCount !== 1 ? 's' : ''} unanswered
              </p>
              <button onClick={submitFinal} className="text-xs font-bold text-primary hover:underline cursor-pointer">Submit anyway</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── ACTIVE QUIZ SCREEN ───────────────────────────────────────────────────
  if (activeQuiz && view === 'active') {
    const question = activeQuiz[currentIndex];
    const isAnswered = !!selectedAnswers[question.id];
    const showFeedback = isAnswered && preferences.feedbackMode === 'immediate';

    return (
      <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-900 flex flex-col justify-between items-center p-3 sm:p-6 transition-colors">
        <div className="w-full max-w-2xl flex-1 flex flex-col justify-between py-1">
          {/* Top Bar with 3-lines menu button at top left */}
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNavOpen(prev => !prev)}
                className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary active:scale-95 transition flex items-center gap-2 cursor-pointer"
                title="View All Question Numbers"
                aria-label="Toggle Question Navigator"
              >
                <Menu size={19} className="text-primary" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Q.{currentIndex + 1}
                  <span className="text-slate-400 dark:text-slate-500 font-normal">/{activeQuiz.length}</span>
                </span>
              </button>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary dark:bg-primary/20 hidden xs:inline-block">
                {Object.keys(selectedAnswers).length} answered
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} 
                className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-95 transition cursor-pointer"
                title="Toggle Theme"
              >
                {preferences.theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {preferences.isTimerEnabled && (
                <div className={cn("flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-sm border", timeLeft <= 10 ? "bg-red-100 text-red-600 border-red-200 animate-pulse" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700")}>
                  <Clock size={15} /> {timeLeft}s
                </div>
              )}
            </div>
          </div>

          {/* Question Navigator Modal/Drawer (Toggled by 3 lines at left top) */}
          <AnimatePresence>
            {isNavOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsNavOpen(false)}
                  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                />

                {/* Modal Container */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 z-10 flex flex-col max-h-[85vh] overflow-hidden"
                >
                  {/* Modal Header */}
                  <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <Menu size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg leading-tight">
                          Question Numbers
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {Object.keys(selectedAnswers).length} of {activeQuiz.length} answered
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsNavOpen(false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition cursor-pointer"
                      title="Close"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-around text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/30"></span>
                      <span>Current</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <span>Answered</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                      <span>Pending</span>
                    </div>
                  </div>

                  {/* Question Grid */}
                  <div className="p-3 sm:p-5 overflow-y-auto max-h-[50vh] grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {activeQuiz.map((q, idx) => {
                      const isCurrent = idx === currentIndex;
                      const isAnswered = !!selectedAnswers[q.id];
                      const isCorrect = isAnswered && selectedAnswers[q.id] === q.correctAnswer;
                      const isImmediate = preferences.feedbackMode === 'immediate';

                      let statusStyle = "bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50";

                      if (isCurrent) {
                        statusStyle = "bg-primary text-white font-bold shadow ring-2 ring-primary/40 border-primary scale-105 z-10";
                      } else if (isAnswered) {
                        if (isImmediate) {
                          statusStyle = isCorrect 
                            ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 font-semibold"
                            : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 font-semibold";
                        } else {
                          statusStyle = "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold";
                        }
                      }

                      return (
                        <button
                          key={q.id}
                          onClick={() => handleJumpToQuestion(idx)}
                          className={cn(
                            "h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center border transition-all active:scale-95 cursor-pointer",
                            statusStyle
                          )}
                          title={`Go to Question ${idx + 1}${isAnswered ? ' (Answered)' : ''}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 text-center text-xs text-slate-500 dark:text-slate-400">
                    Tap any question number to jump directly
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Question Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="bg-white dark:bg-slate-800 p-4 sm:p-7 rounded-2xl sm:rounded-[22px] shadow-lg min-h-[340px] sm:min-h-[400px] flex flex-col justify-between relative overflow-hidden transition-colors"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5 block">
                  Question {currentIndex + 1} of {activeQuiz.length}
                </span>
                <h3 className="text-base sm:text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug sm:leading-normal">
                  {question.questionText}
                </h3>
              </div>

              <div className="space-y-2.5 sm:space-y-3 mt-4 sm:mt-6">
                {Object.entries(question.options).map(([key, val]) => {
                  const isSelected = selectedAnswers[question.id] === key;
                  const isOptionCorrect = key === question.correctAnswer;
                  
                  let bgClass = "bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700";
                  if (isSelected) bgClass = "bg-primary/10 border-primary text-primary-hover dark:text-primary";
                  if (showFeedback) {
                    if (isOptionCorrect) bgClass = "bg-green-100 dark:bg-green-900/30 border-success text-green-800 dark:text-green-300";
                    else if (isSelected) bgClass = "bg-red-100 dark:bg-red-900/30 border-error text-red-800 dark:text-red-300";
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => handleAnswerSelect(key)}
                      disabled={showFeedback}
                      className={cn(
                        "w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-colors duration-150 active:scale-[0.98] flex items-center justify-between font-medium text-sm sm:text-base min-h-[46px] dark:text-slate-200 cursor-pointer",
                        bgClass
                      )}
                    >
                      <span className="flex items-center gap-3 sm:gap-4 flex-1">
                        <span className="w-7 h-7 sm:w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-bold flex-shrink-0">
                          {key}
                        </span>
                        <span className="leading-snug">{val}</span>
                      </span>
                      {showFeedback && isOptionCorrect && <CheckCircle size={20} className="text-success flex-shrink-0 ml-2" />}
                      {showFeedback && isSelected && !isOptionCorrect && <XCircle size={20} className="text-error flex-shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>

              {showFeedback && question.explanation && (
                <div className="mt-4 p-3 sm:p-4 bg-blue-50 dark:bg-slate-700 text-blue-800 dark:text-blue-300 rounded-xl text-xs sm:text-sm leading-relaxed border border-blue-100 dark:border-slate-600">
                  {question.explanation}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom Action Controls */}
          <div className="flex justify-between items-center mt-3 sm:mt-6 gap-2 sm:gap-4">
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => { clearAutoAdvanceTimer(); setCurrentIndex(c => Math.max(0, c - 1)); setTimeLeft(45); }}
                disabled={currentIndex === 0}
                className="px-4 py-2.5 sm:px-6 sm:py-3 font-semibold text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl disabled:opacity-40 transition-colors active:scale-95 cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => { clearAutoAdvanceTimer(); finishQuiz(); }}
                className="px-3.5 py-2.5 sm:px-6 sm:py-3 font-semibold text-xs sm:text-sm text-error hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors active:scale-95 cursor-pointer"
              >
                End Test
              </button>
            </div>
            {currentIndex === activeQuiz.length - 1 ? (
              <button
                onClick={() => { clearAutoAdvanceTimer(); finishQuiz(); }}
                className="px-6 py-2.5 sm:px-8 sm:py-3 font-bold text-xs sm:text-sm bg-primary text-white hover:bg-primary-hover rounded-xl shadow-md transition-colors active:scale-95 cursor-pointer"
              >
                {preferences.feedbackMode === 'review' ? 'Review' : 'Submit'}
              </button>
            ) : (
              <button
                onClick={() => { clearAutoAdvanceTimer(); setCurrentIndex(c => Math.min(activeQuiz.length - 1, c + 1)); setTimeLeft(45); }}
                className="px-6 py-2.5 sm:px-8 sm:py-3 font-bold text-xs sm:text-sm bg-primary text-white hover:bg-primary-hover rounded-xl shadow-md transition-colors active:scale-95 cursor-pointer"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col p-4 sm:p-8 transition-colors pb-12">
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between mb-5 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Play className="text-primary fill-primary" /> FlashMaster
        </h1>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setPreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} 
            className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-95 transition cursor-pointer"
            title="Toggle Theme"
          >
            {preferences.theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 active:scale-95 transition cursor-pointer"><Settings size={18} /></button>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto space-y-5 sm:space-y-8">
        {/* Course / Subject Selection */}
        <section>
          <div className="flex items-center justify-between mb-2.5 sm:mb-3 px-0.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 font-sans">Select Subject</h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Choose course to practice</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Conservation Geography - Primary, Hero Option */}
            <div
              onClick={() => handleSubjectChange('geography')}
              className={cn(
                "relative cursor-pointer p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all active:scale-[0.99] flex flex-col justify-between",
                selectedSubject === 'geography'
                  ? "border-primary bg-primary/[0.04] dark:bg-primary/10 shadow-md ring-2 ring-primary/20"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black tracking-wide bg-primary text-white uppercase">
                    Primary Course
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {geographyQuestions.length} Qs
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Conservation Geography
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprehensive 2026 MOOC Assignments • Weeks 0–12
                </p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold">
                <span className={selectedSubject === 'geography' ? "text-primary font-bold" : "text-slate-400 dark:text-slate-500"}>
                  {selectedSubject === 'geography' ? "● Active Subject" : "Tap to select"}
                </span>
                <span className="text-slate-400 dark:text-slate-500">13 Modules</span>
              </div>
            </div>

            {/* Conservation Economics - Secondary Option */}
            <div
              onClick={() => handleSubjectChange('economics')}
              className={cn(
                "relative cursor-pointer p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all active:scale-[0.99] flex flex-col justify-between",
                selectedSubject === 'economics'
                  ? "border-primary bg-primary/[0.04] dark:bg-primary/10 shadow-md ring-2 ring-primary/20"
                  : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                    Secondary Course
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {economicsQuestions.length} Qs
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Conservation Economics
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  2026 MOOC Assignments • Weeks 1–12
                </p>
              </div>
              <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold">
                <span className={selectedSubject === 'economics' ? "text-primary font-bold" : "text-slate-400 dark:text-slate-500"}>
                  {selectedSubject === 'economics' ? "● Active Subject" : "Tap to select"}
                </span>
                <span className="text-slate-400 dark:text-slate-500">12 Modules</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-4 sm:gap-8">
          <section className="bg-white dark:bg-slate-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 sm:mb-6 font-sans">Assignment Scope</h2>
            <div className="space-y-4">
               <label className="block">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 block">Select Week to Practice</span>
                  <select 
                    value={selectedWeek} 
                    onChange={e => setSelectedWeek(e.target.value)}
                    className="w-full border-2 border-slate-200 dark:border-slate-600 bg-transparent dark:bg-slate-700 rounded-xl p-3 focus:border-primary focus:ring-0 outline-none text-slate-700 dark:text-slate-200 font-medium text-base transition-colors"
                  >
                    <option value="All">All Weeks (Comprehensive)</option>
                    {availableWeeks.map(w => (
                      <option key={w} value={w}>{w}</option>
                    ))}
                  </select>
               </label>
               <div className="p-3.5 sm:p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-4 sm:mt-6 border border-blue-100 dark:border-blue-800 transition-colors">
                  <p className="text-blue-800 dark:text-blue-300 font-medium text-xs sm:text-sm leading-relaxed">
                    {selectedSubject === 'geography'
                      ? `This application is specifically built for your MOOC Assignment practice. All ${geographyQuestions.length} questions from Conservation Geography (Weeks 0–12) are loaded!`
                      : `This application is specifically built for your MOOC Assignment practice. All ${economicsQuestions.length} questions from Conservation Economics (Weeks 1–12) are loaded!`
                    }
                  </p>
               </div>
            </div>
          </section>

          <section className="bg-white dark:bg-slate-800 p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col transition-colors">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 font-sans">Dashboard</h2>
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full">
                {currentSubjectQuestions.length} Qs loaded
              </span>
            </div>
            
            <div className="space-y-4 flex-1">
               <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3"><Shuffle size={18} className="text-primary" /> Randomize Order</span>
                <input type="checkbox" checked={preferences.randomize} onChange={e => setPreferences({ randomize: e.target.checked })} className="w-5 h-5 accent-primary cursor-pointer" />
               </label>
               <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3"><Clock size={18} className="text-primary" /> Timer (45s limit)</span>
                <input type="checkbox" checked={preferences.isTimerEnabled} onChange={e => setPreferences({ isTimerEnabled: e.target.checked })} className="w-5 h-5 accent-primary cursor-pointer" />
               </label>
               <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3"><FastForward size={18} className="text-primary" /> Auto Next Question</span>
                <input type="checkbox" checked={preferences.isAutoNextEnabled ?? true} onChange={e => setPreferences({ isAutoNextEnabled: e.target.checked })} className="w-5 h-5 accent-primary cursor-pointer" />
               </label>
               <div className="pt-2">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Feedback Mode</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPreferences({ feedbackMode: 'immediate' })} className={cn("flex-1 py-2 rounded-lg font-medium border text-sm transition-colors duration-150", preferences.feedbackMode === 'immediate' ? "bg-slate-800 dark:bg-slate-600 text-white border-slate-800 dark:border-slate-500" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600")}>Immediate</button>
                    <button onClick={() => setPreferences({ feedbackMode: 'review' })} className={cn("flex-1 py-2 rounded-lg font-medium border text-sm transition-colors duration-150", preferences.feedbackMode === 'review' ? "bg-slate-800 dark:bg-slate-600 text-white border-slate-800 dark:border-slate-500" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600")}>Review at End</button>
                  </div>
               </div>
            </div>

            <div className="mt-8 flex gap-4">
              {currentSubjectQuestions.length > 0 && (
                <button onClick={clearQuestions} className="p-4 text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl transition"><Trash2 size={20} /></button>
              )}
              <button
                onClick={startQuiz}
                disabled={currentSubjectQuestions.length === 0}
                className="flex-1 bg-primary text-white font-bold py-4 rounded-xl shadow-md hover:bg-primary-hover hover:-translate-y-1 transition disabled:opacity-50 disabled:hover:translate-y-0"
              >
                Start Practice
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
