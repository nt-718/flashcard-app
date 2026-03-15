import { useState, useEffect, useCallback } from 'react'
import materialsManifest from './data/materials.json'

type Language = 'en' | 'cn';
type Result = 'correct' | 'incorrect';

interface Material {
  id: string;
  name: string;
  path: string;
  count: number;
}

interface Sentence {
  jp: string;
  en: string;
  cn?: string;
  pinyin?: string;
  grammar?: string;
  notes?: string;
}

interface SessionRecord {
  timestamp: string;
  material: string;
  language: string;
  correctCount: number;
  incorrectCount: number;
  accuracy: number;
  timeMs: number;
  count: number;
}

interface SavedSession {
  materialId: string;
  language: Language;
  currentIndex: number;
  results: Result[];
  elapsedMs: number;
  totalCount: number;
}

const HISTORY_KEY = 'flashcard-history';
const SESSION_KEY = 'flashcard-session';

function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(records: SessionRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(session: SavedSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function App() {
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [language, setLanguage] = useState<Language | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (selectedMaterial) {
      import(`./data/${selectedMaterial.id}.json`).then(module => {
        setSentences(module.default);
      });
    }
  }, [selectedMaterial]);

  useEffect(() => {
    let interval: number;
    if (startTime && !isFinished) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [startTime, isFinished]);

  // Save session progress whenever index or results change
  useEffect(() => {
    if (!selectedMaterial || !language || isFinished || sentences.length === 0) return;
    saveSession({
      materialId: selectedMaterial.id,
      language,
      currentIndex,
      results,
      elapsedMs: elapsedTime,
      totalCount: sentences.length,
    });
  }, [currentIndex, results]);

  const startFresh = (lang: Language) => {
    setLanguage(lang);
    setStartTime(Date.now());
    setCurrentIndex(0);
    setShowAnswer(false);
    setIsFinished(false);
    setResults([]);
    clearSession();
  };

  const handleStart = (lang: Language) => {
    startFresh(lang);
  };

  const handleResume = (saved: SavedSession) => {
    setLanguage(saved.language);
    setCurrentIndex(saved.currentIndex);
    setResults(saved.results);
    setElapsedTime(saved.elapsedMs);
    setStartTime(Date.now() - saved.elapsedMs);
    setShowAnswer(false);
    setIsFinished(false);
  };

  const logSession = (time: number, res: Result[]) => {
    if (!selectedMaterial || !language) return;
    const correctCount = res.filter(r => r === 'correct').length;
    const incorrectCount = res.filter(r => r === 'incorrect').length;
    const accuracy = res.length > 0 ? Math.round((correctCount / res.length) * 100) : 0;

    const record: SessionRecord = {
      timestamp: new Date().toISOString(),
      material: selectedMaterial.name,
      language: language === 'en' ? 'English' : 'Chinese',
      correctCount,
      incorrectCount,
      accuracy,
      timeMs: time,
      count: sentences.length,
    };

    const history = loadHistory();
    history.push(record);
    saveHistory(history);
    clearSession();
  };

  const handleAnswer = useCallback((result: Result) => {
    const newResults = [...results, result];
    setResults(newResults);
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setIsFinished(true);
      logSession(elapsedTime, newResults);
    }
  }, [currentIndex, sentences.length, results, elapsedTime, selectedMaterial, language]);

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowAnswer(false);
      setResults(prev => prev.slice(0, -1));
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!language || isFinished) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setShowAnswer(prev => !prev);
      } else if (e.code === 'ArrowLeft') {
        handleBack();
      } else if (showAnswer && (e.code === 'Digit1' || e.code === 'Numpad1')) {
        e.preventDefault();
        handleAnswer('correct');
      } else if (showAnswer && (e.code === 'Digit2' || e.code === 'Numpad2')) {
        e.preventDefault();
        handleAnswer('incorrect');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [language, isFinished, showAnswer, handleAnswer]);

  // ─── History View ────────────────────────────────────────────
  if (showHistory) {
    const history = loadHistory();
    const recent = history.slice(-20).reverse();

    return (
      <div style={{ maxWidth: '700px', margin: '40px auto' }}>
        <button onClick={() => setShowHistory(false)} style={{ border: 'none', background: 'none', color: '#6b6b6b', marginBottom: '20px', fontSize: '14px' }}>
          ← ホームに戻る
        </button>
        <h1>📊 学習履歴</h1>
        <p style={{ color: '#6b6b6b', marginBottom: '30px' }}>直近20セッションの正答率推移</p>

        {recent.length === 0 ? (
          <div className="notion-card" style={{ flex: 'none', padding: '40px' }}>
            <p style={{ color: '#6b6b6b' }}>まだ履歴がありません。</p>
          </div>
        ) : (
          <>
            {/* Bar chart */}
            <div className="history-chart">
              {recent.slice().reverse().map((rec, i) => (
                <div key={i} className="history-bar-wrapper" title={`${rec.material} (${rec.language})\n${rec.accuracy}% - ${new Date(rec.timestamp).toLocaleDateString('ja-JP')}`}>
                  <div className="history-bar-label">{rec.accuracy}%</div>
                  <div className="history-bar-track">
                    <div
                      className="history-bar-fill"
                      style={{
                        height: `${rec.accuracy}%`,
                        background: rec.accuracy >= 80 ? '#2db573' : rec.accuracy >= 50 ? '#f5a623' : '#eb5757',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <table className="history-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>教材</th>
                  <th>言語</th>
                  <th>正答</th>
                  <th>誤答</th>
                  <th>正答率</th>
                  <th>時間</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((rec, i) => (
                  <tr key={i}>
                    <td>{new Date(rec.timestamp).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{rec.material.replace('言語学習 - ', '')}</td>
                    <td>{rec.language === 'English' ? '🇬🇧' : '🇨🇳'}</td>
                    <td style={{ color: '#2db573', fontWeight: 600 }}>{rec.correctCount}</td>
                    <td style={{ color: '#eb5757', fontWeight: 600 }}>{rec.incorrectCount}</td>
                    <td>
                      <span className={`accuracy-badge ${rec.accuracy >= 80 ? 'good' : rec.accuracy >= 50 ? 'ok' : 'low'}`}>
                        {rec.accuracy}%
                      </span>
                    </td>
                    <td>{formatTime(rec.timeMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    );
  }

  // ─── Material Selection ────────────────────────────────────
  if (!selectedMaterial) {
    const saved = loadSession();
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto' }}>
        <h1 style={{ textAlign: 'center' }}>教材を選択</h1>
        <p style={{ color: '#6b6b6b', textAlign: 'center', marginBottom: '40px' }}>学習するセットを選んでください</p>
        <div>
          {materialsManifest.map(m => {
            const hasSaved = saved?.materialId === m.id;
            return (
              <div key={m.id} className="material-item" onClick={() => setSelectedMaterial(m)}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '18px' }}>
                    {m.name}
                    {hasSaved && (
                      <span className="resume-badge">
                        {saved!.currentIndex}/{saved!.totalCount}問 再開可
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b6b6b' }}>{m.count} 文</div>
                </div>
                <div style={{ color: '#2383e2' }}>Select →</div>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <button onClick={() => setShowHistory(true)} style={{ padding: '12px 24px', fontSize: '16px' }}>
            📊 学習履歴を見る
          </button>
        </div>
      </div>
    );
  }

  // ─── Language Selection ──────────────────────────────────────
  if (!language) {
    const saved = loadSession();
    const hasSaved = saved && saved.materialId === selectedMaterial.id && saved.currentIndex > 0;

    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <button onClick={() => setSelectedMaterial(null)} style={{ border: 'none', background: 'none', color: '#6b6b6b', marginBottom: '20px' }}>
          ← 教材選択に戻る
        </button>
        <h1>{selectedMaterial.name}</h1>

        {hasSaved ? (
          <>
            <p style={{ color: '#6b6b6b', marginBottom: '32px' }}>
              前回の途中データがあります（{saved.language === 'en' ? 'English' : '中国語'} — {saved.currentIndex}/{saved.totalCount}問完了）
            </p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="primary"
                style={{ padding: '16px 32px', fontSize: '16px' }}
                onClick={() => handleResume(saved)}
              >
                ▶ 続きから再開
              </button>
              <button
                style={{ padding: '16px 32px', fontSize: '16px' }}
                onClick={() => {
                  clearSession();
                  // Force re-render to show language buttons
                  setSelectedMaterial({ ...selectedMaterial });
                }}
              >
                最初からやり直す
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: '#6b6b6b', marginBottom: '40px' }}>学習する言語を選択してください</p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <button className="primary" style={{ padding: '20px 40px', fontSize: '18px' }} onClick={() => handleStart('en')}>
                English
              </button>
              <button className="primary" style={{ padding: '20px 40px', fontSize: '18px' }} onClick={() => handleStart('cn')}>
                中国語
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── Finished ────────────────────────────────────────────────
  if (isFinished) {
    const correctCount = results.filter(r => r === 'correct').length;
    const incorrectCount = results.filter(r => r === 'incorrect').length;
    const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

    return (
      <div style={{ textAlign: 'center', marginTop: '60px' }}>
        <h1 style={{ fontSize: '4rem', margin: '0' }}>🎉</h1>
        <h1>お疲れ様でした！</h1>

        <div className="notion-card" style={{ padding: '40px', margin: '20px auto', maxWidth: '450px', flex: 'none', cursor: 'default' }}>
          <p style={{ fontSize: '20px', margin: '0', color: '#6b6b6b' }}>合計時間</p>
          <p style={{ fontSize: '48px', fontWeight: '700', margin: '10px 0' }}>{formatTime(elapsedTime)}</p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginTop: '20px' }}>
            <div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#2db573' }}>{correctCount}</div>
              <div style={{ fontSize: '13px', color: '#6b6b6b' }}>正解</div>
            </div>
            <div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#eb5757' }}>{incorrectCount}</div>
              <div style={{ fontSize: '13px', color: '#6b6b6b' }}>不正解</div>
            </div>
            <div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: accuracy >= 80 ? '#2db573' : accuracy >= 50 ? '#f5a623' : '#eb5757' }}>{accuracy}%</div>
              <div style={{ fontSize: '13px', color: '#6b6b6b' }}>正答率</div>
            </div>
          </div>

          {/* Mini result bar */}
          <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginTop: '24px', background: 'rgba(15,15,15,0.05)' }}>
            <div style={{ width: `${accuracy}%`, background: '#2db573', transition: 'width 0.5s ease' }} />
            <div style={{ width: `${100 - accuracy}%`, background: '#eb5757', transition: 'width 0.5s ease' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
          <button onClick={() => { setLanguage(null); setSelectedMaterial(null); }}>ホームに戻る</button>
          <button onClick={() => { setShowHistory(true); setLanguage(null); setSelectedMaterial(null); }}>📊 学習履歴</button>
        </div>
      </div>
    );
  }

  // ─── Flashcard View ──────────────────────────────────────────
  const currentSentence = sentences[currentIndex] as Sentence;
  const answer = language === 'en' ? currentSentence?.en : currentSentence?.cn;
  const pinyin = language === 'cn' ? currentSentence?.pinyin : null;
  const notes = language === 'en' ? currentSentence?.notes : null;
  const grammar = language === 'en' ? currentSentence?.grammar : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="notion-tag" style={{ background: language === 'en' ? '#fdecc8' : '#e7f3ef' }}>
            {language === 'en' ? '🇬🇧 English' : '🇨🇳 中国語'}
          </span>
          <span style={{ color: '#6b6b6b', fontSize: '14px' }}>
            {currentIndex + 1} / {sentences.length}
          </span>
          {results.length > 0 && (
            <span style={{ fontSize: '13px', color: '#6b6b6b', marginLeft: '8px' }}>
              ⭕ {results.filter(r => r === 'correct').length} ❌ {results.filter(r => r === 'incorrect').length}
            </span>
          )}
        </div>
        <div style={{ fontSize: '20px', fontWeight: '500', fontFamily: 'monospace' }}>
          {formatTime(elapsedTime)}
        </div>
      </div>

      <div className="controls-wrapper">
        <button
          className="nav-button"
          onClick={handleBack}
          disabled={currentIndex === 0}
          style={{ visibility: currentIndex === 0 ? 'hidden' : 'visible' }}
        >
          ←
        </button>

        <div className="notion-card" onClick={() => setShowAnswer(prev => !prev)}>
          <p style={{ fontSize: '12px', color: '#6b6b6b', position: 'absolute', top: '15px' }}>
            {showAnswer ? 'Answer' : 'Question'} (Click to flip)
          </p>

          {!showAnswer ? (
            <div style={{ fontSize: '28px', fontWeight: '500' }}>
              {currentSentence?.jp}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '28px', fontWeight: '600', color: '#2383e2' }}>
                {answer}
              </div>
              {pinyin && (
                <div style={{ fontSize: '18px', color: '#6b6b6b', marginTop: '8px', fontWeight: '400' }}>
                  {pinyin}
                </div>
              )}
              {grammar && (
                <div style={{ marginTop: '20px', textAlign: 'left', borderTop: '1px solid rgba(15,15,15,0.05)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '12px', color: '#6b6b6b', marginBottom: '4px' }}>Grammar</div>
                  <div style={{ fontSize: '16px', color: '#37352f', opacity: 0.8 }}>{grammar}</div>
                </div>
              )}
              {notes && (
                <div style={{ marginTop: '15px', textAlign: 'left', background: 'rgba(15,15,15,0.03)', padding: '12px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#6b6b6b', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Point</div>
                  <div style={{ fontSize: '14px', color: '#37352f', lineHeight: '1.4' }}>{notes}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side: correct/incorrect buttons when answer is shown, placeholder when hidden */}
        <div className="answer-buttons-column">
          {showAnswer ? (
            <>
              <button className="answer-btn correct" onClick={() => handleAnswer('correct')} title="正解 (1)">
                <span className="answer-btn-icon">⭕</span>
                <span className="answer-btn-label">正解</span>
              </button>
              <button className="answer-btn incorrect" onClick={() => handleAnswer('incorrect')} title="不正解 (2)">
                <span className="answer-btn-icon">❌</span>
                <span className="answer-btn-label">不正解</span>
              </button>
            </>
          ) : (
            <div className="answer-btn-placeholder">
              回答を表示後<br />判定してください
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px', color: '#6b6b6b', fontSize: '12px', textAlign: 'center' }}>
        Space: 回答表示 ｜ 1: 正解 ｜ 2: 不正解 ｜ ←: 前へ
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '4px',
        background: 'rgba(15, 15, 15, 0.05)'
      }}>
        <div style={{
          width: `${((currentIndex + 1) / sentences.length) * 100}%`,
          height: '100%',
          background: '#2383e2',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  )
}

export default App
