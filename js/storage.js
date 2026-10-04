const STORAGE_KEYS = {
  PROGRESS: 'progress_',
  WRONG_ANSWERS: 'wrongAnswers_',
  HISTORY: 'history',
  CURRENT_SESSION: 'currentSession',
  LAST_SUBJECT: 'lastSubject'
};

function checkStorage() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    if (e.code === 22 || e.name === 'QuotaExceededError') {
      alert('Bộ nhớ trình duyệt đã đầy. Vui lòng xóa bớt lịch sử hoặc dữ liệu cũ.');
    }
    return false;
  }
}

export function getProgress(subjectId) {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS + subjectId);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error reading progress:', error);
    return {};
  }
}

export function saveProgress(subjectId, questionId, data) {
  if (!checkStorage()) return;
  try {
    const progress = getProgress(subjectId);
    progress[questionId] = data;
    localStorage.setItem(STORAGE_KEYS.PROGRESS + subjectId, JSON.stringify(progress));
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

export function getWrongAnswers(subjectId) {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WRONG_ANSWERS + subjectId);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading wrong answers:', error);
    return [];
  }
}

export function addWrongAnswer(subjectId, questionId) {
  if (!checkStorage()) return;
  try {
    const wrongAnswers = getWrongAnswers(subjectId);
    if (!wrongAnswers.includes(questionId)) {
      wrongAnswers.push(questionId);
      localStorage.setItem(STORAGE_KEYS.WRONG_ANSWERS + subjectId, JSON.stringify(wrongAnswers));
    }
  } catch (error) {
    console.error('Error adding wrong answer:', error);
  }
}

export function removeWrongAnswer(subjectId, questionId) {
  if (!checkStorage()) return;
  try {
    const wrongAnswers = getWrongAnswers(subjectId);
    const filtered = wrongAnswers.filter(id => id !== questionId);
    localStorage.setItem(STORAGE_KEYS.WRONG_ANSWERS + subjectId, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing wrong answer:', error);
  }
}

export function getHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading history:', error);
    return [];
  }
}

export function addHistory(record) {
  if (!checkStorage()) return;
  try {
    const history = getHistory();
    history.unshift(record);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error('Error adding history:', error);
  }
}

export function deleteHistory(index) {
  if (!checkStorage()) return;
  try {
    const history = getHistory();
    history.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch (error) {
    console.error('Error deleting history:', error);
  }
}

export function clearHistory() {
  if (!checkStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
  } catch (error) {
    console.error('Error clearing history:', error);
  }
}

export function exportHistory() {
  return JSON.stringify(getHistory());
}

export function importHistory(jsonString) {
  if (!checkStorage()) return false;
  try {
    const records = JSON.parse(jsonString);
    if (!Array.isArray(records)) {
      throw new Error('Invalid history format');
    }
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(records));
    return true;
  } catch (error) {
    console.error('Error importing history:', error);
    return false;
  }
}

export function getCurrentSession() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error reading current session:', error);
    return null;
  }
}

export function saveCurrentSession(session) {
  if (!checkStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
  } catch (error) {
    console.error('Error saving current session:', error);
  }
}

export function clearCurrentSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  } catch (error) {
    console.error('Error clearing current session:', error);
  }
}

export function getLastSubject() {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SUBJECT);
  } catch (error) {
    console.error('Error reading last subject:', error);
    return null;
  }
}

export function saveLastSubject(subjectId) {
  if (!checkStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SUBJECT, subjectId);
  } catch (error) {
    console.error('Error saving last subject:', error);
  }
}

export function isStorageAvailable() {
  return checkStorage();
}

export async function loadSubjects() {
  try {
    const response = await fetch('data/subjects.json');
    if (!response.ok) {
      throw new Error(`Failed to load subjects.json: ${response.status} ${response.statusText}`);
    }
    const subjects = await response.json();
    if (!Array.isArray(subjects)) {
      throw new Error('subjects.json must contain an array');
    }
    return subjects;
  } catch (error) {
    console.error('Error loading subjects:', error);
    throw error;
  }
}

export async function loadSubjectData(dataFile) {
  try {
    const response = await fetch(dataFile);
    if (!response.ok) {
      throw new Error(`Failed to load ${dataFile}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();

    if (!data.id || !data.name || !Array.isArray(data.questions)) {
      throw new Error(`Invalid data structure in ${dataFile}`);
    }

    data.questions.forEach((q, idx) => {
      if (!q.id || !q.text || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Question ${idx} in ${dataFile} has invalid structure`);
      }
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3) {
        throw new Error(`Question ${q.id} in ${dataFile} has invalid answer: ${q.answer}`);
      }
    });

    return data;
  } catch (error) {
    console.error(`Error loading subject data from ${dataFile}:`, error);
    throw error;
  }
}
