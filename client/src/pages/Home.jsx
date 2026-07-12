import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Clock, BookOpen, ChevronRight, Search, LogOut, LayoutDashboard, Trophy } from 'lucide-react';

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const res = await api.get('/quizzes');
        setQuizzes(res.data);
      } catch (err) {
        console.error('Failed to fetch quizzes', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuizzes();
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const filtered = quizzes.filter(q =>
    q.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <span className="text-xl font-bold text-slate-100">QuizApp</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Hi, {user?.name?.split(' ')[0]} 👋</span>
            <Link to="/dashboard" className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors p-2">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="relative rounded-3xl bg-gradient-to-br from-primary-600/20 via-slate-900 to-accent-600/20 border border-slate-800 p-8 mb-10 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <h1 className="text-4xl font-bold text-slate-100 mb-3">
              Ready to test your knowledge?
            </h1>
            <p className="text-slate-400 text-lg mb-6">
              Browse available quizzes below and challenge yourself. Track your progress in the dashboard.
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary-400" />
                <span>{quizzes.length} quizzes available</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-accent-400" />
                <span>Instant results after each quiz</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input pl-10 bg-slate-900"
            placeholder="Search quizzes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Quiz grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-5 bg-slate-800 rounded-lg mb-3 w-3/4" />
                <div className="h-3 bg-slate-800 rounded mb-2 w-full" />
                <div className="h-3 bg-slate-800 rounded mb-4 w-1/2" />
                <div className="h-10 bg-slate-800 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">{search ? 'No quizzes match your search.' : 'No quizzes published yet.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((quiz) => (
              <div key={quiz._id} className="card hover:border-primary-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/10 group cursor-pointer flex flex-col"
                onClick={() => navigate(`/quiz/${quiz._id}`)}>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-100 group-hover:text-primary-300 transition-colors leading-tight">
                      {quiz.title}
                    </h3>
                    <BookOpen className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
                  </div>
                  {quiz.description && (
                    <p className="text-slate-500 text-sm mb-3 line-clamp-2">{quiz.description}</p>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {quiz.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {quiz.questionCount} questions
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-primary-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
