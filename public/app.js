(() => {
  // --- State ---
  let resumeData = null;
  const intakeAnswers = {};

  const INTAKE_QUESTIONS = [
    { key: 'target_roles', text: 'What job titles are you targeting? (separate multiple with commas)' },
    { key: 'location', text: 'Preferred work location? (city name or "remote")' },
    { key: 'salary_range', text: 'What is your desired salary range? (e.g., $80k-$120k)' },
    { key: 'job_type', text: 'Are you looking for full-time, part-time, or contract?' },
    { key: 'avoid_list', text: 'Any industries or companies you want to avoid? (or type "none")' }
  ];
  let currentQuestion = 0;

  // --- DOM refs ---
  const screenUpload = document.getElementById('screen-upload');
  const screenChat = document.getElementById('screen-chat');
  const screenDone = document.getElementById('screen-done');
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const uploadStatus = document.getElementById('upload-status');
  const statusText = document.getElementById('status-text');
  const uploadError = document.getElementById('upload-error');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');

  // --- Screen management ---
  function showScreen(screen) {
    [screenUpload, screenChat, screenDone].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  // --- Upload handling ---
  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFile(file);
  });

  async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      showError('Please upload a PDF or DOCX file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('File is too large. Maximum size is 10 MB.');
      return;
    }

    uploadArea.classList.add('hidden');
    uploadError.classList.add('hidden');
    uploadStatus.classList.remove('hidden');
    statusText.textContent = 'Uploading and parsing your resume...';

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch('/api/upload-resume', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Upload failed');
      }

      resumeData = json.data;
      statusText.textContent = 'Resume parsed! Starting intake...';

      setTimeout(() => {
        showScreen(screenChat);
        startIntake();
      }, 800);
    } catch (err) {
      uploadStatus.classList.add('hidden');
      uploadArea.classList.remove('hidden');
      showError(err.message);
    }
  }

  function showError(msg) {
    uploadError.textContent = msg;
    uploadError.classList.remove('hidden');
  }

  // --- Chat intake ---
  function addMessage(text, sender) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    bubble.textContent = text;
    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function startIntake() {
    addMessage(`Hi ${resumeData.name || 'there'}! I've parsed your resume. Let me ask a few quick questions to set up your profile.`, 'bot');
    setTimeout(() => askQuestion(), 600);
  }

  function askQuestion() {
    if (currentQuestion >= INTAKE_QUESTIONS.length) {
      finishIntake();
      return;
    }
    addMessage(INTAKE_QUESTIONS[currentQuestion].text, 'bot');
    chatInput.focus();
  }

  chatSend.addEventListener('click', submitAnswer);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });

  function submitAnswer() {
    const value = chatInput.value.trim();
    if (!value) return;

    addMessage(value, 'user');
    chatInput.value = '';

    const q = INTAKE_QUESTIONS[currentQuestion];

    if (q.key === 'target_roles') {
      intakeAnswers.target_roles = value.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      intakeAnswers[q.key] = value;
    }

    currentQuestion++;
    setTimeout(() => askQuestion(), 400);
  }

  async function finishIntake() {
    addMessage('Thanks! Saving your profile...', 'bot');

    const profile = {
      name: resumeData.name,
      email: resumeData.email,
      phone: resumeData.phone,
      skills: resumeData.skills || [],
      experience: resumeData.experience || [],
      education: resumeData.education || [],
      target_roles: intakeAnswers.target_roles || [],
      location: intakeAnswers.location || null,
      salary_range: intakeAnswers.salary_range || null,
      job_type: intakeAnswers.job_type || null,
      avoid_list: intakeAnswers.avoid_list === 'none' ? null : (intakeAnswers.avoid_list || null)
    };

    try {
      const res = await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');

      setTimeout(() => showScreen(screenDone), 800);
    } catch (err) {
      addMessage(`Something went wrong: ${err.message}. Please try again later.`, 'bot');
    }
  }
})();
