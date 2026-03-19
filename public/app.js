(() => {
  // ================================================================
  // State
  // ================================================================
  let resumeData = null;
  let resumeText = '';
  // Full conversation history sent to the API (role/content pairs)
  const conversationHistory = [];
  // Whether we're waiting for an AI response
  let awaitingAI = false;
  // Whether the profile is complete and we're waiting for confirmation
  let profileComplete = false;
  let pendingProfileSummary = null;

  // ================================================================
  // DOM Refs
  // ================================================================
  const pageLanding = document.getElementById('page-landing');
  const pageApp = document.getElementById('page-app');
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
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  // ================================================================
  // SPA Navigation
  // ================================================================
  function showPage(page) {
    [pageLanding, pageApp].forEach(p => p.classList.remove('active'));
    page.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showAppScreen(target) {
    const screens = [screenUpload, screenChat, screenDone];
    const current = screens.find(s => s.classList.contains('active'));
    if (current === target) return;

    if (current) {
      current.style.transition = 'opacity 0.3s ease';
      current.style.opacity = '0';
      setTimeout(() => {
        current.classList.remove('active');
        current.style.removeProperty('opacity');
        current.style.removeProperty('transition');
        target.classList.add('active');
        target.style.opacity = '0';
        target.style.transition = 'opacity 0.3s ease';
        requestAnimationFrame(() => { target.style.opacity = '1'; });
      }, 300);
    } else {
      target.classList.add('active');
    }
  }

  // Handle [data-nav] clicks
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-nav]');
    if (!trigger) return;
    e.preventDefault();
    const action = trigger.getAttribute('data-nav');
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    if (action === 'get-started') showPage(pageApp);
    else if (action === 'home') showPage(pageLanding);
  });

  // ================================================================
  // Navbar
  // ================================================================
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  }, { passive: true });

  navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  navLinks.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
    });
  });

  // ================================================================
  // Scroll Reveal
  // ================================================================
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // ================================================================
  // Upload Handling
  // ================================================================
  uploadArea.addEventListener('click', (e) => {
    if (e.target.closest('.btn')) return;
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
      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error('Server returned an invalid response. Please try again.');
      }
      if (!res.ok) throw new Error(json.error || 'Upload failed.');

      resumeData = json.data;
      resumeText = json.resumeText || '';
      statusText.textContent = 'Resume parsed successfully!';

      setTimeout(() => {
        showAppScreen(screenChat);
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

  // ================================================================
  // Chat — UI Helpers
  // ================================================================
  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    });
  }

  function addMessageBubble(text, sender) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    // Support newlines in bot messages
    if (sender === 'bot' && text.includes('\n')) {
      bubble.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    } else {
      bubble.textContent = text;
    }
    chatMessages.appendChild(bubble);
    scrollToBottom();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showTypingIndicator() {
    const existing = document.getElementById('typing-indicator');
    if (existing) return;
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatMessages.appendChild(indicator);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
  }

  function showQuickButtons(buttons) {
    // Remove any existing button groups
    removeQuickButtons();
    const group = document.createElement('div');
    group.className = 'chat-button-group';
    group.id = 'chat-button-group';
    buttons.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'chat-quick-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        handleUserInput(label);
      });
      group.appendChild(btn);
    });
    chatMessages.appendChild(group);
    scrollToBottom();
  }

  function removeQuickButtons() {
    const existing = document.getElementById('chat-button-group');
    if (existing) existing.remove();
  }

  function showSaveButton() {
    removeQuickButtons();
    const group = document.createElement('div');
    group.className = 'chat-button-group';
    group.id = 'chat-button-group';
    const btn = document.createElement('button');
    btn.className = 'chat-quick-btn chat-quick-btn-primary';
    btn.textContent = 'Looks good, save my profile';
    btn.addEventListener('click', () => saveProfile());
    group.appendChild(btn);

    const editBtn = document.createElement('button');
    editBtn.className = 'chat-quick-btn';
    editBtn.textContent = 'I want to change something';
    editBtn.addEventListener('click', () => {
      handleUserInput('I want to change something');
    });
    group.appendChild(editBtn);

    chatMessages.appendChild(group);
    scrollToBottom();
  }

  function setInputEnabled(enabled) {
    chatInput.disabled = !enabled;
    chatSend.disabled = !enabled;
    if (enabled) chatInput.focus();
  }

  // ================================================================
  // Chat — AI Conversation
  // ================================================================
  async function startIntake() {
    // Send initial message to AI to get personalized greeting
    setInputEnabled(false);
    showTypingIndicator();

    // The first message triggers the AI greeting
    conversationHistory.push({
      role: 'user',
      content: 'Hi, I just uploaded my resume. Please start by reviewing it and introducing yourself.'
    });

    try {
      const response = await callChatAPI();
      hideTypingIndicator();

      // Remove the synthetic first user message from visible chat
      // (the user didn't actually type it)
      addMessageBubble(response.message, 'bot');

      if (response.buttons && response.buttons.length > 0) {
        showQuickButtons(response.buttons);
      }

      setInputEnabled(true);
    } catch (err) {
      hideTypingIndicator();
      addMessageBubble('Something went wrong starting the conversation. Please refresh and try again.', 'bot');
      setInputEnabled(true);
    }
  }

  async function handleUserInput(text) {
    if (awaitingAI || !text.trim()) return;

    const userText = text.trim();
    removeQuickButtons();
    addMessageBubble(userText, 'user');

    // Add to conversation history
    conversationHistory.push({ role: 'user', content: userText });

    awaitingAI = true;
    setInputEnabled(false);
    showTypingIndicator();

    try {
      const response = await callChatAPI();
      hideTypingIndicator();
      awaitingAI = false;

      addMessageBubble(response.message, 'bot');

      if (response.profileComplete && response.profileSummary) {
        profileComplete = true;
        pendingProfileSummary = response.profileSummary;
        showSaveButton();
      } else if (response.buttons && response.buttons.length > 0) {
        showQuickButtons(response.buttons);
      }

      setInputEnabled(true);
    } catch (err) {
      hideTypingIndicator();
      awaitingAI = false;
      addMessageBubble('Sorry, something went wrong. Please try typing your answer again.', 'bot');
      setInputEnabled(true);
    }
  }

  async function callChatAPI() {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resumeData,
        resumeText,
        messages: conversationHistory
      })
    });

    let json;
    try {
      json = await res.json();
    } catch {
      throw new Error('Server returned an invalid response.');
    }

    if (!res.ok) throw new Error(json.error || 'Chat request failed.');

    // Add assistant response to conversation history
    conversationHistory.push({ role: 'assistant', content: json.message });

    return json;
  }

  // ================================================================
  // Chat — Input handlers
  // ================================================================
  chatSend.addEventListener('click', () => {
    const value = chatInput.value.trim();
    if (value) {
      chatInput.value = '';
      handleUserInput(value);
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const value = chatInput.value.trim();
      if (value) {
        chatInput.value = '';
        handleUserInput(value);
      }
    }
  });

  // ================================================================
  // Save Profile
  // ================================================================
  async function saveProfile() {
    removeQuickButtons();
    addMessageBubble('Saving your profile\u2026', 'bot');
    showTypingIndicator();

    const profile = {
      name: resumeData.name,
      email: resumeData.email,
      phone: resumeData.phone,
      skills: resumeData.skills || [],
      experience: resumeData.experience || [],
      education: resumeData.education || [],
      target_roles: pendingProfileSummary.target_roles || [],
      location: pendingProfileSummary.location || null,
      salary_range: pendingProfileSummary.salary_range || null,
      job_type: pendingProfileSummary.job_type || null,
      avoid_list: pendingProfileSummary.avoid_list || null
    };

    try {
      const res = await fetch('/api/save-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error('Server returned an invalid response.');
      }

      if (!res.ok) throw new Error(json.error || 'Save failed.');

      hideTypingIndicator();
      addMessageBubble('Profile saved! Redirecting you now\u2026', 'bot');
      setTimeout(() => showAppScreen(screenDone), 1000);
    } catch (err) {
      hideTypingIndicator();
      addMessageBubble(`Something went wrong: ${err.message}. Please try again later.`, 'bot');
    }
  }
})();
