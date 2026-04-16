import React, { useState } from 'react';
import { useQuizStore } from './lib/store';
import { Play, Shuffle, Settings, Trash2, Clock, CheckCircle, XCircle, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Question } from './lib/types';
import { cn } from './lib/utils';
import { preloadedQuestions } from './data';

function App() {
  const { questions, setQuestions, preferences, setPreferences, clearQuestions } = useQuizStore();
  const [activeQuiz, setActiveQuiz] = useState<Question[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(45);
  const [quizFinished, setQuizFinished] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState<string>('All');

  React.useEffect(() => {
    // Force loaded data over stale DB defaults to capture any code-side corrections
    setQuestions(preloadedQuestions);
  }, []);

  // Apply dark mode class to html element
  React.useEffect(() => {
    if (preferences.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [preferences.theme]);

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

  const startQuiz = () => {
    let qToPlay: Question[] = preloadedQuestions.map(shuffleOptions);
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
    setQuizFinished(false);
  };

  React.useEffect(() => {
    if (!activeQuiz || quizFinished || !preferences.isTimerEnabled) return;
    
    // Auto-advance if timer runs out
    if (timeLeft <= 0) {
      if (currentIndex === activeQuiz.length - 1) {
        submitQuiz();
      } else {
        setCurrentIndex(c => c + 1);
        setTimeLeft(45);
      }
      return;
    }

    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, [activeQuiz, quizFinished, timeLeft, currentIndex, preferences.isTimerEnabled]);

  const submitQuiz = () => {
    setQuizFinished(true);
  };

  const handleAnswerSelect = (opt: string) => {
    if (!activeQuiz) return;
    const qId = activeQuiz[currentIndex].id;
    if (selectedAnswers[qId]) return; // Prevent clicking multiple times
    
    setSelectedAnswers(prev => ({ ...prev, [qId]: opt }));
    
    // Auto-advance logic for immediate mode
    if (preferences.feedbackMode === 'immediate') {
      setTimeout(() => {
        if (currentIndex === activeQuiz.length - 1) {
          submitQuiz();
        } else {
          setCurrentIndex(c => c + 1);
          setTimeLeft(45);
        }
      }, 1500); // 1.5s delay to review right/wrong
    }
  };

  if (activeQuiz && quizFinished) {
    const correctCount = activeQuiz.filter(q => selectedAnswers[q.id] === q.correctAnswer).length;
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 transition-colors">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8 bg-white dark:bg-slate-800 shadow-xl rounded-2xl max-w-lg w-full text-center transition-colors">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Quiz Results</h2>
          <div className="text-6xl font-black mb-4 text-primary">{Math.round((correctCount / activeQuiz.length) * 100)}%</div>
          <p className="text-slate-600 dark:text-slate-300 mb-8">{correctCount} out of {activeQuiz.length} correct</p>
          <button onClick={() => setActiveQuiz(null)} className="bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-hover transition shadow-md">Back to Dashboard</button>
        </motion.div>
      </div>
    );
  }

  if (activeQuiz) {
    const question = activeQuiz[currentIndex];
    const isAnswered = !!selectedAnswers[question.id];
    const showFeedback = isAnswered && preferences.feedbackMode === 'immediate';

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Question {currentIndex + 1} of {activeQuiz.length}</span>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setPreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} 
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title="Toggle Theme"
              >
                {preferences.theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              {preferences.isTimerEnabled && (
                <div className={cn("flex items-center gap-2 font-bold px-4 py-2 rounded-full", timeLeft <= 10 ? "bg-red-100 text-red-600 animate-pulse" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200")}>
                  <Clock size={18} /> {timeLeft}s
                </div>
              )}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={question.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="bg-white dark:bg-slate-800 p-8 rounded-[16px] shadow-lg min-h-[400px] flex flex-col relative overflow-hidden transition-colors"
            >
              <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-8">{question.questionText}</h3>
              <div className="space-y-3 flex-1 flex flex-col justify-end">
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
                        "w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between font-medium text-lg min-h-[44px] dark:text-slate-200",
                        bgClass
                      )}
                    >
                      <span className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm text-slate-500 dark:text-slate-400">{key}</span>
                        {val}
                      </span>
                      {showFeedback && isOptionCorrect && <CheckCircle className="text-success" />}
                      {showFeedback && isSelected && !isOptionCorrect && <XCircle className="text-error" />}
                    </button>
                  );
                })}
              </div>
              {showFeedback && question.explanation && (
                <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm">
                  {question.explanation}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <div className="flex justify-between mt-8">
            <div className="flex gap-4">
              <button
                onClick={() => { setCurrentIndex(c => Math.max(0, c - 1)); setTimeLeft(45); }}
                disabled={currentIndex === 0}
                className="px-6 py-3 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl disabled:opacity-50 transition"
              >
                Previous
              </button>
              <button
                onClick={submitQuiz}
                className="px-6 py-3 font-medium text-error hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition"
              >
                End Test
              </button>
            </div>
            {currentIndex === activeQuiz.length - 1 ? (
              <button
                onClick={submitQuiz}
                className="px-8 py-3 font-bold bg-primary text-white hover:bg-primary-hover rounded-xl shadow-md transition"
              >
                Submit
              </button>
            ) : (
              <button
                onClick={() => { setCurrentIndex(c => Math.min(activeQuiz.length - 1, c + 1)); setTimeLeft(45); }}
                className="px-8 py-3 font-bold bg-primary text-white hover:bg-primary-hover rounded-xl shadow-md transition"
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col p-8 transition-colors">
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between mb-12">
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Play className="text-primary fill-primary" /> FlashMaster
        </h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setPreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} 
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Toggle Theme"
          >
            {preferences.theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"><Settings size={20} /></button>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto grid md:grid-cols-2 gap-8">
        <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 font-sans">Assignment Scope</h2>
          <div className="space-y-4">
             <label className="block">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 block">Select Week to Practice</span>
                <select 
                  value={selectedWeek} 
                  onChange={e => setSelectedWeek(e.target.value)}
                  className="w-full border-2 border-slate-200 dark:border-slate-600 bg-transparent dark:bg-slate-700 rounded-xl p-3 focus:border-primary focus:ring-0 outline-none text-slate-700 dark:text-slate-200 font-medium transition-colors"
                >
                  <option value="All">All Weeks (Comprehensive)</option>
                  {[...new Set(questions.map(q => q.weekId))].map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
             </label>
             <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl mt-6 border border-blue-100 dark:border-blue-800 transition-colors">
                <p className="text-blue-800 dark:text-blue-300 font-medium text-sm">
                  This application is specifically built for your MOOC Assignment practice. All {preloadedQuestions.length} questions from the PDF are pre-loaded!
                </p>
             </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col transition-colors">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-sans">Dashboard</h2>
            <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full">{preloadedQuestions.length} Qs loaded</span>
          </div>
          
          <div className="space-y-4 flex-1">
             <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3"><Shuffle size={18} className="text-primary" /> Randomize Order</span>
              <input type="checkbox" checked={preferences.randomize} onChange={e => setPreferences({ randomize: e.target.checked })} className="w-5 h-5 accent-primary" />
             </label>
             <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3"><Clock size={18} className="text-primary" /> Timer (45s limit)</span>
              <input type="checkbox" checked={preferences.isTimerEnabled} onChange={e => setPreferences({ isTimerEnabled: e.target.checked })} className="w-5 h-5 accent-primary" />
             </label>
             <div className="pt-4">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Feedback Mode</p>
                <div className="flex gap-2">
                  <button onClick={() => setPreferences({ feedbackMode: 'immediate' })} className={cn("flex-1 py-2 rounded-lg font-medium border text-sm transition", preferences.feedbackMode === 'immediate' ? "bg-slate-800 dark:bg-slate-600 text-white border-slate-800 dark:border-slate-500" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600")}>Immediate</button>
                  <button onClick={() => setPreferences({ feedbackMode: 'review' })} className={cn("flex-1 py-2 rounded-lg font-medium border text-sm transition", preferences.feedbackMode === 'review' ? "bg-slate-800 dark:bg-slate-600 text-white border-slate-800 dark:border-slate-500" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600")}>Review at End</button>
                </div>
             </div>
          </div>

          <div className="mt-8 flex gap-4">
            {preloadedQuestions.length > 0 && (
              <button onClick={clearQuestions} className="p-4 text-red-500 bg-red-50 hover:bg-red-100 rounded-xl transition"><Trash2 size={20} /></button>
            )}
            <button
              onClick={startQuiz}
              disabled={preloadedQuestions.length === 0}
              className="flex-1 bg-primary text-white font-bold py-4 rounded-xl shadow-md hover:bg-primary-hover hover:-translate-y-1 transition disabled:opacity-50 disabled:hover:translate-y-0"
            >
              Start Practice
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
