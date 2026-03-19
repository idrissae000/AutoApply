(() => {
  // --- State ---
  let resumeData = null;
  const intakeAnswers = {};

  const INTAKE_QUESTIONS = [
    { key: 'target_roles', text: 'What job titles are you targeting? (separate multiple with commas)' },
    { key: 'location', text: 'Preferred work location? (city name or "remote")' },
    { key: 'salary_range', text: 'What is your desired salary range? (e.g., $80k\u2013$120k)' },
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
  const errorText = document.getElementById('error-text');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');

  // --- Screen transitions ---
  function showScreen(target) {
    const screens = [screenUpload, screenChat, screenDone];
    const current = screens.find(s => s.classList.contains('active'));

    if (current === target) return;

    if (current) {
      current.style.opacity = '1';
      current.style.transition = 'opacity 0.3s ease';
      current.style.opacity = '0';

      setTimeout(() => {
        current.classList.remove('active');
        current.style.removeProperty('opacity');
        current.style.removeProperty('transition');

        target.classList.add('active', 'screen-enter');
        target.addEventListener('animationend', () => {
          target.classList.remove('screen-enter');
        }, { once: true });
      }, 300);
    } else {
      target.classList.add('active');
    }
  }

  // --- Upload handling ---
  uploadArea.addEventListener('click', (e) => {
    if (e.target.closest('.btn-primary')) {
      // Let the label handle it
      return;
    }
    fileInput.click();
  });

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
    statusText.textContent = 'Uploading and parsing your resume\u2026';

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch('/api/upload-resume', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Upload failed');
      }

      resumeData = json.data;
      statusText.textContent = 'Resume parsed successfully!';

      setTimeout(() => {
        showScreen(screenChat);
        setTimeout(() => startIntake(), 400);
      }, 600);
    } catch (err) {
      uploadStatus.classList.add('hidden');
      uploadArea.classList.remove('hidden');
      showError(err.message);
    }
  }

  function showError(msg) {
    errorText.textContent = msg;
    uploadError.classList.remove('hidden');
  }

  // --- Chat intake ---
  function addMessage(text, sender) {
    return new Promise((resolve) => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${sender}`;
      bubble.textContent = text;
      chatMessages.appendChild(bubble);
      requestAnimationFrame(() => {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
      });
      // Resolve after animation completes
      setTimeout(resolve, 350);
    });
  }

  function showTyping() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatMessages.appendChild(indicator);
    requestAnimationFrame(() => {
      chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    });
  }

  function hideTyping() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  async function addBotMessage(text) {
    showTyping();
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    hideTyping();
    await addMessage(text, 'bot');
  }

  async function startIntake() {
    const name = resumeData.name ? resumeData.name.split(' ')[0] : 'there';
    await addBotMessage(`Hi ${name}! I\u2019ve parsed your resume successfully. Let me ask a few quick questions to set up your profile.`);
    askQuestion();
  }

  async function askQuestion() {
    if (currentQuestion >= INTAKE_QUESTIONS.length) {
      finishIntake();
      return;
    }
    await addBotMessage(INTAKE_QUESTIONS[currentQuestion].text);
    chatInput.focus();
  }

  chatSend.addEventListener('click', submitAnswer);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) submitAnswer();
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
    setTimeout(() => askQuestion(), 300);
  }

  async function finishIntake() {
    await addBotMessage('Thanks! Saving your profile\u2026');

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

      await addBotMessage('All done! Redirecting you now\u2026');
      setTimeout(() => showScreen(screenDone), 800);
    } catch (err) {
      await addBotMessage(`Something went wrong: ${err.message}. Please try again later.`);
    }
  }
})();
