/**
 * IC3 GS6 Level 3 - Quiz App Logic Engine
 * Premium Vanilla JavaScript Web Application
 */

// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================
let allQuestions = [];          // Stores the complete list of questions
let questions = [];             // Stores the active list of questions for the session
let currentLevel = 3;           // Stores the currently selected level: 2 or 3
let selectedMode = 'full';      // 'full', 'topic', or 'random50'
let selectedTopic = '';         // Selected topic string
let userAnswers = {};           // Stores user selections: { questionId: answer }
let flaggedQuestions = new Set(); // Stores flagged question IDs
let currentIndex = 0;           // Current question index
let isSubmitted = false;        // Has the user submitted the quiz?
let currentFilter = 'all';      // Sidebar question grid filter
let timerInterval = null;
let timeLeft = 50 * 60;         // Time left in seconds (calculated dynamically)
let timeSpent = 0;

// Shuffled items for matching questions (pre-calculated once per quiz run to avoid re-shuffling on render)
let matchingShuffledOptions = {}; 

// ==========================================================================
// INITIALIZATION & DYNAMIC LOADER
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    setupEventListeners();
    await loadQuestions();
    updateLevelUITexts();
    
    if (allQuestions.length === 0) {
        const qText = document.getElementById('question-text');
        if (qText) {
            qText.innerText = 'Không thể tải dữ liệu câu hỏi. Vui lòng chạy server hoặc kiểm tra questions.js.';
        }
        return;
    }
    
    populateTopics();
}

/**
 * Dynamic level switching functionality.
 */
async function switchLevel(level) {
    if (currentLevel === level) return;
    currentLevel = level;
    
    // Update tabs active styles generically
    const levelTabs = document.querySelectorAll('.level-tab');
    levelTabs.forEach(tab => {
        const tabLevel = parseInt(tab.getAttribute('data-level'));
        if (tabLevel === level) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Load the correct level questions database
    await loadQuestions();
    
    // Update welcome titles and mock exam text in the UI
    updateLevelUITexts();
    
    // Populate the topic select dynamically
    populateTopics();
}

/**
 * Dynamic welcome screen and header UI text injection based on selected Level.
 */
function updateLevelUITexts() {
    const welcomeTitle = document.getElementById('welcome-title');
    if (welcomeTitle) {
        welcomeTitle.innerText = `Luyện Thi IC3 GS6 Level ${currentLevel}`;
    }
    
    const headerLevelText = document.getElementById('header-level-text');
    if (headerLevelText) {
        headerLevelText.innerText = `Level ${currentLevel} • Practice Exam`;
    }
    
    const fullExamMeta = document.getElementById('full-exam-meta');
    if (fullExamMeta) {
        const count = allQuestions.length;
        fullExamMeta.innerHTML = `<i class="fa-solid fa-circle-question"></i> ${count} câu hỏi • <i class="fa-solid fa-clock"></i> 50 phút`;
    }
}

/**
 * Hybrid loader: attempts to fetch correct level JSON first (web server mode)
 * and falls back to corresponding window.quizQuestions defined in level JS files (offline mode).
 */
async function loadQuestions() {
    let filename = 'questions.json';
    let fallbackVar = window.quizQuestions;
    let fallbackName = 'questions.js';
    
    if (currentLevel === 2) {
        filename = 'questions_level2.json';
        fallbackVar = window.quizQuestionsLevel2;
        fallbackName = 'questions_level2.js';
    } else if (currentLevel === 1) {
        filename = 'questions_level1.json';
        fallbackVar = window.quizQuestionsLevel1;
        fallbackName = 'questions_level1.js';
    }
    
    try {
        const response = await fetch(filename + '?t=' + Date.now());
        if (!response.ok) throw new Error('CORS or Network Error');
        allQuestions = await response.json();
        console.log(`Loaded ${allQuestions.length} questions successfully via ${filename}`);
    } catch (err) {
        console.warn(`Cannot fetch ${filename} directly. Using offline ${fallbackName} fallback...`);
        if (fallbackVar && fallbackVar.length > 0) {
            allQuestions = fallbackVar;
            console.log(`Successfully loaded offline questions from ${fallbackName}`);
        } else {
            console.error(`Failed to load questions from all sources for Level ${currentLevel}.`);
            allQuestions = [];
        }
    }
}

/**
 * Dynamically extract and populate the unique list of topics into the welcome select menu.
 */
function populateTopics() {
    const topicSelect = document.getElementById('welcome-topic-select');
    if (!topicSelect) return;
    
    // Group and count questions per topic
    const topicsMap = {};
    allQuestions.forEach(q => {
        if (q.topic) {
            topicsMap[q.topic] = (topicsMap[q.topic] || 0) + 1;
        }
    });
    
    // 1. Populate native hidden select (for compatibility)
    topicSelect.innerHTML = '<option value="">-- Chọn chủ đề luyện tập --</option>';
    Object.keys(topicsMap).sort().forEach(topic => {
        const count = topicsMap[topic];
        const option = document.createElement('option');
        option.value = topic;
        option.innerText = `${topic} (${count} câu)`;
        topicSelect.appendChild(option);
    });
    
    // 2. Populate custom glassmorphic select container
    const customWrapper = document.getElementById('custom-select-options-wrapper');
    const customTrigger = document.getElementById('custom-select-trigger');
    if (customWrapper && customTrigger) {
        customWrapper.innerHTML = '';
        
        // Add default option
        const defaultOpt = document.createElement('div');
        defaultOpt.className = 'custom-select-option selected';
        defaultOpt.innerHTML = `<span>-- Chọn chủ đề luyện tập --</span>`;
        defaultOpt.setAttribute('data-value', '');
        customWrapper.appendChild(defaultOpt);
        
        // Add other topic options with visual count badge
        Object.keys(topicsMap).sort().forEach(topic => {
            const count = topicsMap[topic];
            const optEl = document.createElement('div');
            optEl.className = 'custom-select-option';
            optEl.setAttribute('data-value', topic);
            optEl.innerHTML = `
                <span>${topic}</span>
                <span class="topic-count-badge">${count} câu</span>
            `;
            customWrapper.appendChild(optEl);
        });
        
        // Reset trigger text
        customTrigger.querySelector('span').innerText = '-- Chọn chủ đề luyện tập --';
        
        // Add option click listeners
        const allCustomOpts = customWrapper.querySelectorAll('.custom-select-option');
        allCustomOpts.forEach(opt => {
            opt.addEventListener('click', (e) => {
                const val = opt.getAttribute('data-value');
                
                // Toggle active option styling
                allCustomOpts.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                
                // Update trigger text
                if (val) {
                    customTrigger.querySelector('span').innerText = val;
                } else {
                    customTrigger.querySelector('span').innerText = '-- Chọn chủ đề luyện tập --';
                }
                
                // Update hidden native select and dispatch native event
                topicSelect.value = val;
                topicSelect.dispatchEvent(new Event('change'));
                
                // Close dropdown menu
                const container = document.getElementById('custom-select-container');
                if (container) container.classList.remove('open');
                e.stopPropagation();
            });
        });
    }
}

// Helper to visually reset custom select options
function resetCustomSelect() {
    const customTrigger = document.getElementById('custom-select-trigger');
    const customWrapper = document.getElementById('custom-select-options-wrapper');
    if (customTrigger && customWrapper) {
        customTrigger.querySelector('span').innerText = '-- Chọn chủ đề luyện tập --';
        const allOpts = customWrapper.querySelectorAll('.custom-select-option');
        allOpts.forEach(o => {
            o.classList.remove('selected');
            if (o.getAttribute('data-value') === '') {
                o.classList.add('selected');
            }
        });
    }
}


// ==========================================================================
// QUIZ STATE MANAGEMENT
// ==========================================================================
function resetQuizState() {
    userAnswers = {};
    flaggedQuestions.clear();
    currentIndex = 0;
    isSubmitted = false;
    timeSpent = 0;
    matchingShuffledOptions = {};
    
    // Hide results panel, reset view
    document.getElementById('results-panel').style.display = 'none';
    document.getElementById('review-banner-top').style.display = 'none';
    document.getElementById('submit-btn').style.display = 'inline-flex';
    document.getElementById('sidebar').style.transform = '';
    
    // Setup pre-shuffled options for matching questions
    questions.forEach(q => {
        if (q.type === 'matching') {
            // Collect all unique right-hand descriptions and shuffle them
            const rightOptions = q.answers.map(ans => ans.right);
            matchingShuffledOptions[q.id] = shuffleArray([...rightOptions]);
        }
    });

    // Reset Sidebar cells & Filter buttons
    currentFilter = 'all';
    updateFilterButtons();
    buildQuestionGrid();
    
    // Reset Timer
    clearInterval(timerInterval);
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.innerText = formattedDisplay;
    timerDisplay.parentElement.classList.remove('danger');
    startTimer();
    
    // Render first question
    renderQuestion(currentIndex);
    updateProgressBar();
}

// Utility to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Randomize question sequence and option selections within each question to prevent rote memorization.
 * Deep copies the original array to avoid permanently changing the raw database.
 */
function prepareQuestionsWithOptionsShuffled(origQuestions) {
    // Deep copy to prevent mutating the global database
    const shuffledList = JSON.parse(JSON.stringify(origQuestions));
    
    // Shuffles the question list order
    if (currentLevel !== 1 || selectedMode === 'random50') {
        shuffleArray(shuffledList);
    }
    
    // Shuffles options and sub-elements inside each question
    shuffledList.forEach(q => {
        // 1. Single and Multiple choice options
        if ((q.type === 'single' || q.type === 'multiple') && q.options && q.options.length > 0) {
            const correctLetters = Array.isArray(q.answers) ? q.answers : [q.answers];
            
            // Map correct choice letters to their actual texts
            const correctTexts = q.options
                .filter(opt => correctLetters.includes(opt.letter))
                .map(opt => opt.text);
                
            // Shuffle the choices
            shuffleArray(q.options);
            
            // Re-assign option letters in order: a, b, c, d...
            const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            q.options.forEach((opt, idx) => {
                opt.letter = letters[idx] || String.fromCharCode(97 + idx);
            });
            
            // Locate new letters for correct texts
            const newCorrectLetters = q.options
                .filter(opt => correctTexts.includes(opt.text))
                .map(opt => opt.letter);
                
            // Re-apply to q.answers
            if (q.type === 'single') {
                q.answers = newCorrectLetters[0] || '';
            } else {
                q.answers = newCorrectLetters;
            }
        }
        
        // 2. Grid statements rows
        else if (q.type === 'grid' && q.options && q.options.length > 0) {
            shuffleArray(q.options);
        }
        
        // 3. Sorting steps list
        else if (q.type === 'sorting' && q.options && q.options.length > 0) {
            shuffleArray(q.options);
        }
        
        // 4. Matching left items list
        else if (q.type === 'matching' && q.options && q.options.length > 0) {
            shuffleArray(q.options);
        }
        
        // 5. Dropdown blank sentences list
        else if (q.type === 'dropdown_grid' && q.options && q.options.length > 0) {
            shuffleArray(q.options);
        }
    });
    
    return shuffledList;
}

/**
 * Deduplicates questions by text similarity and option overlap to prevent duplicates
 */
function deduplicateQuestionsList(array) {
    const result = [];
    
    for (let i = 0; i < array.length; i++) {
        const q1 = array[i];
        let isDuplicate = false;
        
        for (let j = 0; j < result.length; j++) {
            const q2 = result[j];
            
            // Check if question text, type, and options length are the same
            if (q1.question.trim().toLowerCase() === q2.question.trim().toLowerCase() && q1.type === q2.type) {
                if (q1.type === 'single' || q1.type === 'multiple') {
                    const opts1 = q1.options.map(o => o.text.trim().toLowerCase());
                    const opts2 = q2.options.map(o => o.text.trim().toLowerCase());
                    
                    let matches = 0;
                    opts1.forEach(o1 => {
                        if (opts2.some(o2 => o2 === o1)) {
                            matches++;
                        }
                    });
                    
                    if (matches >= 2) {
                        isDuplicate = true;
                        break;
                    }
                } else if (q1.type === 'hotspot') {
                    if (q1.image_file === q2.image_file) {
                        isDuplicate = true;
                        break;
                    }
                } else if (q1.options && q2.options) {
                    const opts1 = q1.options.map(o => o.trim().toLowerCase());
                    const opts2 = q2.options.map(o => o.trim().toLowerCase());
                    
                    let matches = 0;
                    opts1.forEach(o1 => {
                        if (opts2.some(o2 => o2 === o1)) {
                            matches++;
                        }
                    });
                    
                    if (matches >= 2) {
                        isDuplicate = true;
                        break;
                    }
                }
            }
        }
        
        if (!isDuplicate) {
            result.push(q1);
        }
    }
    
    return result;
}

// ==========================================================================
// COUNTDOWN TIMER
// ==========================================================================
function startTimer() {
    timerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            alert('Hết giờ làm bài! Hệ thống tự động nộp bài làm của bạn.');
            submitExam(true);
            return;
        }
        
        timeLeft--;
        timeSpent++;
        
        // Format Display
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const formattedDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const timerDisplay = document.getElementById('timer-display');
        timerDisplay.innerText = formattedDisplay;
        
        // Visual warning under 5 minutes (300 seconds)
        if (timeLeft <= 300) {
            timerDisplay.parentElement.classList.add('danger');
        }
    }, 1000);
}

// ==========================================================================
// QUESTION NAVIGATION SIDEBAR GRID
// ==========================================================================
function buildQuestionGrid() {
    const grid = document.getElementById('question-grid');
    grid.innerHTML = '';
    
    questions.forEach((q, idx) => {
        // Create Cell Button
        const cell = document.createElement('button');
        cell.className = 'question-cell';
        cell.id = `grid-cell-${q.id}`;
        cell.innerText = idx + 1;
        
        // Event click
        cell.addEventListener('click', () => {
            if (currentIndex === idx) return;
            currentIndex = idx;
            renderQuestion(currentIndex);
        });
        
        grid.appendChild(cell);
        updateCellState(q.id);
    });
}

function updateCellState(qId) {
    const cell = document.getElementById(`grid-cell-${qId}`);
    if (!cell) return;
    
    // Clear dynamic states
    cell.classList.remove('active', 'answered', 'flagged', 'correct', 'incorrect');
    
    const qIndex = questions.findIndex(q => q.id === qId);
    
    // 1. Check active state
    if (currentIndex === qIndex) {
        cell.classList.add('active');
    }
    
    // 2. Check answered state
    if (isAnswered(questions[qIndex])) {
        cell.classList.add('answered');
    }
    
    // 3. Check flagged state
    if (flaggedQuestions.has(qId)) {
        cell.classList.add('flagged');
    }
    
    // 4. Check results review state
    if (isSubmitted) {
        const isCorrect = gradeQuestion(questions[qIndex]);
        if (isCorrect) {
            cell.classList.add('correct');
        } else {
            cell.classList.add('incorrect');
        }
    }
    
    // Handle filter visibility
    applyCellFilter(cell, qId);
}

function applyCellFilter(cell, qId) {
    const q = questions.find(q => q.id === qId);
    const answered = isAnswered(q);
    const flagged = flaggedQuestions.has(qId);
    
    let visible = true;
    
    if (currentFilter === 'answered' && !answered) visible = false;
    else if (currentFilter === 'unanswered' && answered) visible = false;
    else if (currentFilter === 'flagged' && !flagged) visible = false;
    
    cell.style.display = visible ? 'flex' : 'none';
}

function filterQuestionGrid(filterType) {
    currentFilter = filterType;
    updateFilterButtons();
    questions.forEach(q => {
        const cell = document.getElementById(`grid-cell-${q.id}`);
        if (cell) applyCellFilter(cell, q.id);
    });
}

function updateFilterButtons() {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        if (btn.getAttribute('data-filter') === currentFilter) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Helper to determine if a question has been answered
function isAnswered(q) {
    const answer = userAnswers[q.id];
    if (answer === undefined || answer === null) return false;
    
    if (q.type === 'single') {
        return answer !== '';
    }
    if (q.type === 'multiple') {
        return Array.isArray(answer) && answer.length > 0;
    }
    if (q.type === 'grid') {
        // Must answer all items in the grid
        const answeredCount = Object.keys(answer).length;
        return answeredCount === q.options.length;
    }
    if (q.type === 'sorting') {
        // Must select steps positions for all items
        const answeredCount = Object.keys(answer).length;
        return answeredCount === q.options.length;
    }
    if (q.type === 'matching') {
        // Must select matches for all left items
        const answeredCount = Object.keys(answer).length;
        return answeredCount === q.options.length;
    }
    if (q.type === 'dropdown_grid') {
        // Must fill dropdowns for all sentences
        const answeredCount = Object.keys(answer).length;
        return answeredCount === q.options.length;
    }
    if (q.type === 'hotspot') {
        return Array.isArray(answer) && answer.length === q.max_selections;
    }
    return false;
}

// ==========================================================================
// RENDER CURRENT QUESTION CARD
// ==========================================================================
function renderQuestion(index) {
    const q = questions[index];
    
    // 1. Update Title Header & Topic
    document.getElementById('current-q-num').innerText = index + 1;
    const totalQNum = document.getElementById('total-q-num');
    if (totalQNum) totalQNum.innerText = questions.length;
    document.getElementById('current-topic-text').innerText = q.topic;
    document.getElementById('question-text').innerText = q.question;
    
    // 2. Handle Media Visibility (Image vs Video vs Default Placeholder)
    const imgPlaceholder = document.getElementById('image-placeholder-container');
    const questionImg = document.getElementById('question-img');
    const questionVideo = document.getElementById('question-video');
    const defaultPlaceholder = document.getElementById('image-placeholder-default');
    
    // Reset media elements first
    if (questionImg) {
        questionImg.style.display = 'none';
        questionImg.src = '';
        questionImg.style.maxWidth = '100%';
    }
    if (questionVideo) {
        questionVideo.style.display = 'none';
        questionVideo.src = '';
    }
    
    if (q.has_image && q.type !== 'hotspot') {
        imgPlaceholder.style.display = 'block';
        if (q.image_file && q.image_file !== 'None' && q.image_file !== '') {
            const isVideo = q.image_file.toLowerCase().endsWith('.mp4');
            if (isVideo) {
                if (questionVideo) {
                    questionVideo.src = q.image_file;
                    questionVideo.style.display = 'block';
                }
            } else {
                if (questionImg) {
                    questionImg.src = q.image_file;
                    questionImg.style.display = 'block';
                    if (q.id === 'q143') {
                        questionImg.style.maxWidth = window.innerWidth <= 768 ? '90%' : '50%';
                    }
                }
            }
            if (defaultPlaceholder) {
                defaultPlaceholder.style.display = 'none';
            }
        } else {
            if (defaultPlaceholder) {
                defaultPlaceholder.style.display = 'flex';
            }
        }
    } else {
        imgPlaceholder.style.display = 'none';
    }
    
    // 3. Render Answer Options dynamically
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    switch (q.type) {
        case 'single':
            renderSingleChoice(q, optionsContainer);
            break;
        case 'multiple':
            renderMultipleChoice(q, optionsContainer);
            break;
        case 'grid':
            renderGrid(q, optionsContainer);
            break;
        case 'sorting':
            renderSorting(q, optionsContainer);
            break;
        case 'matching':
            renderMatching(q, optionsContainer);
            break;
        case 'dropdown_grid':
            renderDropdownGrid(q, optionsContainer);
            break;
        case 'hotspot':
            renderHotspot(q, optionsContainer);
            break;
    }
    
    // 4. Update Footer Navigation Buttons
    const prevBtn = document.getElementById('prev-btn');
    prevBtn.disabled = index === 0;
    
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    if (index === questions.length - 1) {
        nextBtn.style.display = 'none';
        if (!isSubmitted) submitBtn.style.display = 'inline-flex';
    } else {
        nextBtn.style.display = 'inline-flex';
        submitBtn.style.display = 'none';
    }
    
    // 5. Update Bookmark Button State
    const flagBtn = document.getElementById('flag-btn');
    if (flaggedQuestions.has(q.id)) {
        flagBtn.classList.add('flagged-active');
        flagBtn.innerHTML = '<i class="fa-solid fa-flag"></i> Đã đánh dấu';
    } else {
        flagBtn.classList.remove('flagged-active');
        flagBtn.innerHTML = '<i class="fa-regular fa-flag"></i> Đánh dấu câu khó';
    }
    
    // 6. Highlight active sidebar cell
    questions.forEach(otherQ => {
        const cell = document.getElementById(`grid-cell-${otherQ.id}`);
        if (cell) {
            cell.classList.remove('active');
            if (questions[index].id === otherQ.id) {
                cell.classList.add('active');
            }
        }
    });
    
    updateProgressBar();
}

/**
 * 1. Render Single Choice Question (Radio Cards)
 */
function renderSingleChoice(q, container) {
    container.innerHTML = '';
    const savedAns = userAnswers[q.id] || '';
    
    q.options.forEach(opt => {
        const card = document.createElement('div');
        card.className = 'option-card';
        
        // Active Selection Highlight
        if (savedAns === opt.letter) {
            card.classList.add('selected');
        }
        
        // Submit Review Highlight
        if (isSubmitted) {
            card.style.pointerEvents = 'none'; // Disable actions in review
            
            const isCorrectOption = q.answers === opt.letter;
            const isUserOption = savedAns === opt.letter;
            
            if (isCorrectOption) {
                card.classList.add('correct');
            } else if (isUserOption && !isCorrectOption) {
                card.classList.add('incorrect');
            }
        }
        
        let optionContent = `<div class="option-text">${opt.text}</div>`;
        if (opt.image) {
            optionContent = `<div class="option-text" style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start;">
                <img src="${opt.image}" class="option-img-file" style="max-height: 80px; display: block; border-radius: 6px; border: 1px solid var(--border-color); background: #fff; padding: 4px;" alt="Đáp án ${opt.letter.toUpperCase()}">
                <span>${opt.text}</span>
            </div>`;
        }
        
        card.innerHTML = `
            <div class="option-circle">${opt.letter}</div>
            ${optionContent}
        `;
        
        // Click listener
        if (!isSubmitted) {
            card.addEventListener('click', () => {
                userAnswers[q.id] = opt.letter;
                renderSingleChoice(q, container); // Re-render this card
                updateCellState(q.id);
            });
        }
        
        container.appendChild(card);
    });
}

/**
 * 2. Render Multiple Choice (Checkbox Cards with Selection Limit)
 */
function renderMultipleChoice(q, container) {
    const savedAns = userAnswers[q.id] || [];
    
    // Add multiple choice label info
    const hint = document.createElement('div');
    hint.className = 'multiple-selection-hint';
    hint.innerHTML = `<i class="fa-solid fa-circle-info"></i> Hãy chọn chính xác <strong>${q.max_selections}</strong> câu trả lời:`;
    container.appendChild(hint);
    
    q.options.forEach(opt => {
        const card = document.createElement('div');
        card.className = 'option-card';
        
        const isSelected = savedAns.includes(opt.letter);
        if (isSelected) {
            card.classList.add('selected');
        }
        
        if (isSubmitted) {
            card.style.pointerEvents = 'none';
            const isCorrectOption = q.answers.includes(opt.letter);
            if (isCorrectOption) {
                card.classList.add('correct');
            } else if (isSelected && !isCorrectOption) {
                card.classList.add('incorrect');
            }
        }
        
        let optionContent = `<div class="option-text">${opt.text}</div>`;
        if (opt.image) {
            optionContent = `<div class="option-text" style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start;">
                <img src="${opt.image}" class="option-img-file" style="max-height: 80px; display: block; border-radius: 6px; border: 1px solid var(--border-color); background: #fff; padding: 4px;" alt="Đáp án ${opt.letter.toUpperCase()}">
                <span>${opt.text}</span>
            </div>`;
        }
        
        if (isSubmitted && opt.explanation) {
            optionContent += `<div class="answer-explanation">${opt.explanation}</div>`;
        }
        
        card.innerHTML = `
            <div class="option-circle" style="border-radius: 6px;">
                ${isSelected ? '<i class="fa-solid fa-check" style="font-size: 0.75rem;"></i>' : opt.letter}
            </div>
            ${optionContent}
        `;
        
        if (!isSubmitted) {
            card.addEventListener('click', () => {
                let currentSelections = [...savedAns];
                if (currentSelections.includes(opt.letter)) {
                    // Deselect
                    currentSelections = currentSelections.filter(c => c !== opt.letter);
                } else {
                    // Check limit before adding
                    if (currentSelections.length >= q.max_selections) {
                        alert(`Dạng câu hỏi này chỉ cho phép chọn tối đa ${q.max_selections} đáp án!`);
                        return;
                    }
                    currentSelections.push(opt.letter);
                }
                userAnswers[q.id] = currentSelections;
                renderQuestion(currentIndex); // Re-render to update the hint text / checks
                updateCellState(q.id);
            });
        }
        
        container.appendChild(card);
    });
}

/**
 * 3. Render Grid True/False or Yes/No Statement Table
 */
function renderGrid(q, container) {
    const savedAns = userAnswers[q.id] || {};
    
    // Detect choices from the data grid. Standard choices are e.g., Đúng/Sai, Có/Không, Bảo vệ/Rủi ro, Máy in laser/Máy in phun
    // We can infer the columns list by checking the answers
    const choices = [];
    if (q.answers && q.answers.length > 0) {
        q.answers.forEach(ans => {
            if (ans.answer && !choices.includes(ans.answer)) {
                choices.push(ans.answer);
            }
        });
    }
    
    // Normalize and standardize the column headers list for consistent presentation:
    if (choices.includes('Đúng') || choices.includes('Sai')) {
        choices.length = 0;
        choices.push('Đúng', 'Sai');
    } else if (choices.includes('Có') || choices.includes('Không')) {
        choices.length = 0;
        choices.push('Có', 'Không');
    } else if (choices.includes('Bảo vệ') || choices.includes('Rủi ro')) {
        choices.length = 0;
        choices.push('Bảo vệ', 'Rủi ro');
    } else if (choices.includes('Máy in laser') || choices.includes('Máy in phun')) {
        choices.length = 0;
        choices.push('Máy in laser', 'Máy in phun');
    } else if (choices.includes('Không mỏi mắt') || choices.includes('Mỏi mắt')) {
        choices.length = 0;
        choices.push('Không mỏi mắt', 'Mỏi mắt');
    } else if (choices.includes('Phần Mềm Hệ Thống') || choices.includes('Phần Mềm Ứng Dụng') || choices.includes('phần mềm Hệ thống') || choices.includes('phần mềm Ứng dụng')) {
        choices.length = 0;
        choices.push('Phần Mềm Hệ Thống', 'Phần Mềm Ứng Dụng');
    } else if (choices.includes('Google') || choices.includes('Microsoft') || choices.includes('Apple')) {
        choices.length = 0;
        choices.push('Google', 'Microsoft', 'Apple');
    } else if (choices.length === 0) {
        choices.push('Đúng', 'Sai'); // Fallback default
    }

    
    const table = document.createElement('table');
    table.className = 'grid-table';
    
    // Table Header
    let theadHTML = `<tr><th>Phát biểu / Tình huống</th>`;
    choices.forEach(ch => {
        const colWidth = ch.length > 10 ? 220 : 120;
        theadHTML += `<th style="width: ${colWidth}px; text-align: center;">${ch}</th>`;
    });
    theadHTML += `</tr>`;
    table.innerHTML = theadHTML;
    
    const tbody = document.createElement('tbody');
    
    q.options.forEach((subQ, rIdx) => {
        const tr = document.createElement('tr');
        
        // Sub-question cell text
        let rowHTML = `<td>
            ${subQ}
            ${isSubmitted ? `<div class="grid-correct-hint" id="correct-hint-${q.id}-${rIdx}"></div>` : ''}
        </td>`;
        
        // Choice selection cells
        choices.forEach(ch => {
            rowHTML += `<td style="text-align: center;">
                <button class="grid-choice-btn" 
                        data-row="${subQ}" 
                        data-choice="${ch}"
                        id="grid-btn-${q.id}-${rIdx}-${ch}">
                    ${ch}
                </button>
            </td>`;
        });
        
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Apply state and click listeners
    q.options.forEach((subQ, rIdx) => {
        const rowSelection = savedAns[subQ];
        
        choices.forEach(ch => {
            const btn = document.getElementById(`grid-btn-${q.id}-${rIdx}-${ch}`);
            if (!btn) return;
            
            // Check active status
            if (rowSelection === ch) {
                btn.classList.add('selected');
            }
            
            // Review state highlighting
            if (isSubmitted) {
                btn.style.pointerEvents = 'none';
                
                const correctObj = q.answers.find(ans => ans.sub_question === subQ);
                const correctAns = correctObj ? correctObj.answer : '';
                
                // If this cell was selected by the user
                if (rowSelection === ch) {
                    if (rowSelection === correctAns) {
                        btn.classList.add('correct-state');
                    } else {
                        btn.classList.add('incorrect-state');
                    }
                }
                
                // Show hint text beside subquestion
                const hintDiv = document.getElementById(`correct-hint-${q.id}-${rIdx}`);
                if (hintDiv) {
                    const explanation = correctObj && correctObj.explanation ? correctObj.explanation : '';
                    hintDiv.innerHTML = `<i class="fa-solid fa-circle-check"></i> \u0110\u00e1p \u00e1n \u0111\u00fang: <strong>${correctAns}</strong>${explanation ? `<div class="answer-explanation">${explanation}</div>` : ''}`;
                }
            }
            
            // Click Handler
            if (!isSubmitted) {
                btn.addEventListener('click', () => {
                    if (!userAnswers[q.id]) userAnswers[q.id] = {};
                    userAnswers[q.id][subQ] = ch;
                    
                    // Trigger selection visual refresh
                    choices.forEach(otherCh => {
                        const otherBtn = document.getElementById(`grid-btn-${q.id}-${rIdx}-${otherCh}`);
                        if (otherBtn) {
                            if (otherCh === ch) otherBtn.classList.add('selected');
                            else otherBtn.classList.remove('selected');
                        }
                    });
                    
                    updateCellState(q.id);
                });
            }
        });
    });
}

/**
 * 4. Render Sorting Question (Steps positioning selects)
 */
function renderSorting(q, container) {
    const savedAns = userAnswers[q.id] || {};
    const n = q.options.length;
    
    const list = document.createElement('div');
    list.className = 'sorting-list';
    
    q.options.forEach((step, idx) => {
        const row = document.createElement('div');
        row.className = 'sorting-row';
        
        const rowText = document.createElement('div');
        rowText.className = 'sorting-row-text';
        rowText.innerText = step;
        row.appendChild(rowText);
        
        // Render Dropdown selector
        const select = document.createElement('select');
        select.className = 'select-input';
        select.id = `sort-select-${q.id}-${idx}`;
        
        let selectHTML = `<option value="">-- Chọn thứ tự --</option>`;
        for (let j = 1; j <= n; j++) {
            selectHTML += `<option value="${j}">Bước ${j}</option>`;
        }
        select.innerHTML = selectHTML;
        
        // Restore user answer
        const savedOrder = savedAns[step] || '';
        select.value = savedOrder;
        
        // Review mode classes
        if (isSubmitted) {
            select.disabled = true;
            
            // Find correct order position in answers
            const correctOrderIdx = q.answers.indexOf(step) + 1; // 1-indexed
            
            if (parseInt(savedOrder) === correctOrderIdx) {
                select.classList.add('correct');
            } else {
                select.classList.add('incorrect');
                // Display the correct answer beneath select
                const correctLabel = document.createElement('span');
                correctLabel.className = 'review-correct-val';
                correctLabel.innerHTML = `<i class="fa-solid fa-check"></i> Phải là: <strong>Bước ${correctOrderIdx}</strong>`;
                row.appendChild(correctLabel);
            }
        }
        
        // Event click
        if (!isSubmitted) {
            select.addEventListener('change', (e) => {
                if (!userAnswers[q.id]) userAnswers[q.id] = {};
                
                const val = e.target.value;
                if (val === '') {
                    delete userAnswers[q.id][step];
                } else {
                    userAnswers[q.id][step] = parseInt(val);
                }
                
                updateCellState(q.id);
            });
        }
        
        row.appendChild(select);
        list.appendChild(row);
    });
    
    container.appendChild(list);
}

/**
 * 5. Render Matching Columns Question
 */
function renderMatching(q, container) {
    const savedAns = userAnswers[q.id] || {};
    
    const list = document.createElement('div');
    list.className = 'matching-list';
    
    // Check if this is a custom question to render premium horizontal image cards
    let isCustomImageMatching = false;
    let choices = [];
    if (q.id === 'q67' && currentLevel === 2) {
        isCustomImageMatching = true;
        choices = [
            { letter: 'a', val: 'Thông báo (Notification/Reminder)', label: 'Đáp án 1', img: 'level 2 chu de 1 cau 67 dap an 1 .jpg' },
            { letter: 'b', val: 'Sự kiện cả ngày (All-day event)', label: 'Đáp án 2', img: 'level 2 chu de 1 cau 67 dap an 2 .jpg' },
            { letter: 'c', val: 'Lời mời (Invite/Share)', label: 'Đáp án 3', img: 'level 2 chu de 1 cau 67 dap an 3 .jpg' },
            { letter: 'd', val: 'Sự kiện lặp lại (Recurrence/Repeat)', label: 'Đáp án 4', img: 'level 2 chu de 1 cau 67 dap an 4 .jpg' }
        ];
    } else if (q.id === 'q5' && currentLevel === 1) {
        isCustomImageMatching = true;
        choices = [
            { letter: 'a', val: 'level1_page_3_img_3_X7.jpg', label: 'Audio Port', img: 'level1_page_3_img_3_X7.jpg' },
            { letter: 'b', val: 'level1_page_3_img_3_X8.jpg', label: 'USB Port', img: 'level1_page_3_img_3_X8.jpg' },
            { letter: 'c', val: 'level1_page_3_img_3_X9.jpg', label: 'HDMI Port', img: 'level1_page_3_img_3_X9.jpg' },
            { letter: 'd', val: 'level1_page_3_img_3_X10.jpg', label: 'Ethernet Port', img: 'level1_page_3_img_3_X10.jpg' },
            { letter: 'e', val: 'level1_page_3_img_3_X11.jpg', label: 'Display Port', img: 'level1_page_3_img_3_X11.jpg' }
        ];
    } else if (q.id === 'q20' && currentLevel === 1) {
        isCustomImageMatching = true;
        choices = [
            { letter: 'a', val: 'level1_page_8_img_3_X30.jpg', label: 'USB', img: 'level1_page_8_img_3_X30.jpg' },
            { letter: 'b', val: 'level1_page_8_img_3_X31.jpg', label: 'Lightning', img: 'level1_page_8_img_3_X31.jpg' },
            { letter: 'c', val: 'level1_page_8_img_3_X32.jpg', label: 'USB-C', img: 'level1_page_8_img_3_X32.jpg' },
            { letter: 'd', val: 'level1_page_8_img_3_X33.jpg', label: 'Micro USB', img: 'level1_page_8_img_3_X33.jpg' }
        ];
    } else if (q.id === 'q21' && currentLevel === 1) {
        isCustomImageMatching = true;
        choices = [
            { letter: 'a', val: 'level1_page_8_img_7_X34.jpg', label: 'B\u1ed9 x\u1eed l\u00fd trung t\u00e2m (CPU)', img: 'level1_page_8_img_7_X34.jpg' },
            { letter: 'b', val: 'level1_page_8_img_7_X35.jpg', label: '\u1ed4 \u0111\u0129a c\u1ee9ng', img: 'level1_page_8_img_7_X35.jpg' },
            { letter: 'c', val: 'level1_page_8_img_7_X39.jpg', label: 'Bo m\u1ea1ch ch\u1ee7', img: 'level1_page_8_img_7_X39.jpg' },
            { letter: 'd', val: 'level1_page_8_img_7_X40.jpg', label: '\u1ed4 c\u1ee9ng th\u1ec3 r\u1eafn', img: 'level1_page_8_img_7_X40.jpg' }
        ];
    }
    
    if (isCustomImageMatching) {
        q.options.forEach((leftItem, idx) => {
            const row = document.createElement('div');
            row.className = 'matching-row-custom';
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '0.75rem';
            row.style.marginBottom = '1.5rem';
            row.style.padding = '1rem';
            row.style.background = 'rgba(255, 255, 255, 0.03)';
            row.style.borderRadius = '12px';
            row.style.border = '1px solid rgba(255, 255, 255, 0.08)';
            
            const rowText = document.createElement('div');
            rowText.className = 'matching-row-text';
            rowText.style.fontWeight = '600';
            rowText.style.fontSize = '1rem';
            rowText.innerHTML = `<span style="color: var(--primary-light); margin-right: 0.5rem;">Ý ${idx + 1}:</span> ${leftItem}`;
            row.appendChild(rowText);
            
            // Grid of option cards
            const cardsContainer = document.createElement('div');
            cardsContainer.style.display = 'grid';
            cardsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';
            cardsContainer.style.gap = '0.75rem';
            cardsContainer.style.width = '100%';
            
            const savedMatch = savedAns[leftItem] || '';
            
            choices.forEach(ch => {
                const card = document.createElement('div');
                card.className = 'option-card';
                card.style.flexDirection = 'column';
                card.style.alignItems = 'center';
                card.style.textAlign = 'center';
                card.style.padding = '0.75rem';
                card.style.gap = '0.5rem';
                card.style.cursor = 'pointer';
                card.style.background = 'rgba(255, 255, 255, 0.04)';
                
                if (savedMatch === ch.val) {
                    card.classList.add('selected');
                }
                
                if (isSubmitted) {
                    card.style.pointerEvents = 'none';
                    const correctObj = q.answers.find(ans => ans.left === leftItem);
                    const correctRight = correctObj ? correctObj.right : '';
                    
                    if (ch.val === correctRight) {
                        card.classList.add('correct');
                    } else if (savedMatch === ch.val && savedMatch !== correctRight) {
                        card.classList.add('incorrect');
                    }
                }
                
                card.innerHTML = `
                    <div class="option-circle" style="margin-bottom: 4px;">${ch.letter.toUpperCase()}</div>
                    <img src="${ch.img}" style="max-width: 100%; max-height: 80px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); padding: 2px; background: #fff;" alt="${ch.label}">
                    <span style="font-size: 0.8rem; font-weight: 500; opacity: 0.9;">${ch.label}</span>
                `;
                
                if (!isSubmitted) {
                    card.addEventListener('click', () => {
                        if (!userAnswers[q.id]) userAnswers[q.id] = {};
                        userAnswers[q.id][leftItem] = ch.val;
                        
                        // Re-render
                        renderQuestion(currentIndex);
                        updateCellState(q.id);
                    });
                }
                
                cardsContainer.appendChild(card);
            });
            
            row.appendChild(cardsContainer);
            
            // Show hint under row in review mode if wrong
            if (isSubmitted) {
                const correctObj = q.answers.find(ans => ans.left === leftItem);
                const correctRight = correctObj ? correctObj.right : '';
                const correctChoice = choices.find(ch => ch.val === correctRight);
                
                if (savedMatch !== correctRight) {
                    const reviewHint = document.createElement('div');
                    reviewHint.className = 'review-correct-val';
                    reviewHint.style.marginTop = '0.5rem';
                    reviewHint.style.fontSize = '0.9rem';
                    reviewHint.innerHTML = `<i class="fa-solid fa-circle-check"></i> Đáp án đúng là: <strong>${correctChoice.letter.toUpperCase()} (${correctChoice.label})</strong>`;
                    row.appendChild(reviewHint);
                }
            }
            
            list.appendChild(row);
        });
        
        container.appendChild(list);
        return;
    }
    
    // Default matching list rendering using select dropdowns
    // Use pre-shuffled right items
    const rightShuffled = matchingShuffledOptions[q.id] || [];
    
    q.options.forEach((leftItem, idx) => {
        const row = document.createElement('div');
        row.className = 'matching-row';
        
        const rowText = document.createElement('div');
        rowText.className = 'matching-row-text';
        rowText.innerHTML = `<strong>${leftItem}</strong>`;
        row.appendChild(rowText);
        
        // Dropdown containing right side options
        const select = document.createElement('select');
        select.className = 'select-input';
        select.id = `match-select-${q.id}-${idx}`;
        
        let selectHTML = `<option value="">-- Chọn mô tả khớp nối --</option>`;
        rightShuffled.forEach(desc => {
            selectHTML += `<option value="${desc}">${desc}</option>`;
        });
        select.innerHTML = selectHTML;
        
        const savedMatch = savedAns[leftItem] || '';
        select.value = savedMatch;
        
        // Review modes
        if (isSubmitted) {
            select.disabled = true;
            
            const correctObj = q.answers.find(ans => ans.left === leftItem);
            const correctRight = correctObj ? correctObj.right : '';
            
            if (savedMatch === correctRight) {
                select.classList.add('correct');
            } else {
                select.classList.add('incorrect');
                // Display the correct answer beneath select
                const correctLabel = document.createElement('span');
                correctLabel.className = 'review-correct-val';
                correctLabel.innerHTML = `<i class="fa-solid fa-circle-check"></i> Khớp đúng: <br><strong>${correctRight}</strong>`;
                row.appendChild(correctLabel);
            }
        }
        
        // Event click
        if (!isSubmitted) {
            select.addEventListener('change', (e) => {
                if (!userAnswers[q.id]) userAnswers[q.id] = {};
                
                const val = e.target.value;
                if (val === '') {
                    delete userAnswers[q.id][leftItem];
                } else {
                    userAnswers[q.id][leftItem] = val;
                }
                
                updateCellState(q.id);
            });
        }
        
        row.appendChild(select);
        list.appendChild(row);
    });
    
    container.appendChild(list);
}

/**
 * 6. Render Dropdown Blank Grid Fillers (Inline Select blanks)
 */
function renderDropdownGrid(q, container) {
    const savedAns = userAnswers[q.id] || {};
    
    const list = document.createElement('div');
    list.className = 'dropdown-grid-list';
    
    // Collect all bold correct answers in this question's sentences as options for dropdowns
    const dropdownOptionsList = q.answers.map(ans => ans.answer);
    
    q.options.forEach((sentence, idx) => {
        const row = document.createElement('div');
        row.className = 'dropdown-grid-row';
        row.style.flexDirection = 'column';
        row.style.alignItems = 'flex-start';
        
        const sentenceContainer = document.createElement('div');
        sentenceContainer.className = 'dropdown-grid-text';
        sentenceContainer.style.width = '100%';
        
        // Locate where the blank spacer "________" is
        const savedWord = savedAns[sentence] || '';
        
        const selectId = `dropdown-blank-${q.id}-${idx}`;
        
        // Build Select Input HTML
        let selectHTML = `<select class="select-input inline-select" id="${selectId}" style="width: auto;">`;
        selectHTML += `<option value="">[Chọn từ khóa]</option>`;
        dropdownOptionsList.forEach(optVal => {
            selectHTML += `<option value="${optVal}">${optVal}</option>`;
        });
        selectHTML += `</select>`;
        
        // Replace blank with our select HTML element
        const sentenceWithSelect = sentence.replace("________", selectHTML);
        sentenceContainer.innerHTML = sentenceWithSelect;
        row.appendChild(sentenceContainer);
        
        list.appendChild(row);
    });
    
    container.appendChild(list);
    
    // Apply values and click events after rendering elements to DOM
    q.options.forEach((sentence, idx) => {
        const selectId = `dropdown-blank-${q.id}-${idx}`;
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const savedWord = savedAns[sentence] || '';
        select.value = savedWord;
        
        if (isSubmitted) {
            select.disabled = true;
            
            const correctObj = q.answers.find(ans => ans.sentence === sentence);
            const correctWord = correctObj ? correctObj.answer : '';
            
            if (savedWord === correctWord) {
                select.classList.add('correct');
            } else {
                select.classList.add('incorrect');
                // Append text hint
                const row = select.closest('.dropdown-grid-row');
                const correctLabel = document.createElement('span');
                correctLabel.className = 'review-correct-val';
                correctLabel.innerHTML = `<i class="fa-solid fa-circle-check"></i> Điền đúng: <strong>${correctWord}</strong>`;
                row.appendChild(correctLabel);
            }
        }
        
        if (!isSubmitted) {
            select.addEventListener('change', (e) => {
                if (!userAnswers[q.id]) userAnswers[q.id] = {};
                
                const val = e.target.value;
                if (val === '') {
                    delete userAnswers[q.id][sentence];
                } else {
                    userAnswers[q.id][sentence] = val;
                }
                
                updateCellState(q.id);
            });
        }
    });
}

/**
 * 7. Render Interactive Image Hotspot Question (Flag Pinning)
 */
function renderHotspot(q, container) {
    // 1. Create a wrapper container for hotspot question
    const wrapper = document.createElement('div');
    wrapper.className = 'hotspot-question-wrapper';
    wrapper.style.textAlign = 'center';
    wrapper.style.width = '100%';
    
    // Hint for hotspot
    const hint = document.createElement('p');
    hint.className = 'multiple-selection-hint';
    hint.style.marginBottom = '1.5rem';
    
    if (isSubmitted) {
        hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> Chế độ xem lại: Vùng viền xanh lá đứt nét là vùng đáp án đúng. Vị trí cờ là điểm bạn đã nhấp chọn.';
    } else {
        const selectedCount = (userAnswers[q.id] || []).length;
        hint.innerHTML = `<i class="fa-solid fa-circle-question"></i> Bạn đã cắm <strong>${selectedCount} / ${q.max_selections}</strong> cờ. Nhấp chuột vào hình để cắm cờ hoặc nhấp lại cờ cũ để xóa.`;
    }
    wrapper.appendChild(hint);
    
    // 2. Create the relative-positioned image wrapper
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'hotspot-image-wrapper';
    
    // Create the image element
    const img = document.createElement('img');
    img.className = 'hotspot-img';
    img.src = q.image_file;
    img.alt = 'Hotspot Question Image';
    imgWrapper.appendChild(img);
    
    // Retrieve user answers
    if (!userAnswers[q.id]) {
        userAnswers[q.id] = [];
    }
    const currentFlags = userAnswers[q.id];
    
    // 3. Draw existing flags
    currentFlags.forEach((flag, flagIdx) => {
        const flagEl = document.createElement('div');
        flagEl.className = 'hotspot-flag';
        flagEl.style.left = `${flag.x}%`;
        flagEl.style.top = `${flag.y}%`;
        
        // Flag icon
        flagEl.innerHTML = `<i class="fa-solid fa-flag"></i>`;
        
        if (isSubmitted) {
            // Grade this specific flag
            let isFlagCorrect = false;
            for (let box of q.answers) {
                if (flag.x >= box.x_min && flag.x <= box.x_max && flag.y >= box.y_min && flag.y <= box.y_max) {
                    isFlagCorrect = true;
                    break;
                }
            }
            if (isFlagCorrect) {
                flagEl.classList.add('correct');
            } else {
                flagEl.classList.add('incorrect');
            }
        }
        
        imgWrapper.appendChild(flagEl);
    });
    
    // 4. In review mode, draw correct answer bounding boxes
    if (isSubmitted) {
        q.answers.forEach(box => {
            const overlay = document.createElement('div');
            overlay.className = 'hotspot-correct-overlay';
            overlay.style.left = `${box.x_min}%`;
            overlay.style.top = `${box.y_min}%`;
            overlay.style.width = `${box.x_max - box.x_min}%`;
            overlay.style.height = `${box.y_max - box.y_min}%`;
            
            overlay.innerHTML = `<span><i class="fa-solid fa-circle-check"></i> ${box.name}</span>`;
            imgWrapper.appendChild(overlay);
        });
    }
    
    // 5. Click event handler for flag placement (only in non-submitted mode)
    if (!isSubmitted) {
        img.addEventListener('click', (e) => {
            const rect = img.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            // Check if user clicked very close to an existing flag (e.g. within 5% radius) to remove it
            let flagRemoved = false;
            for (let i = 0; i < currentFlags.length; i++) {
                const dist = Math.sqrt(Math.pow(currentFlags[i].x - x, 2) + Math.pow(currentFlags[i].y - y, 2));
                if (dist < 5.0) { // 5% radius threshold for removal
                    currentFlags.splice(i, 1);
                    flagRemoved = true;
                    break;
                }
            }
            
            if (!flagRemoved) {
                // If we already have max selections, FIFO: remove the oldest one
                if (currentFlags.length >= q.max_selections) {
                    currentFlags.shift();
                }
                // Add the new flag coordinate
                currentFlags.push({ x, y });
            }
            
            // Save answer state and re-render
            userAnswers[q.id] = currentFlags;
            updateCellState(q.id);
            renderQuestion(currentIndex);
        });
    }
    
    wrapper.appendChild(imgWrapper);
    container.appendChild(wrapper);
}

// ==========================================================================
// SCORING ENGINE & RESULTS GENERATION
// ==========================================================================
function isAllCorrect(q) {
    const answer = userAnswers[q.id];
    if (answer === undefined) return false;
    
    // 1. Single Choice
    if (q.type === 'single') {
        return answer === q.answers;
    }
    
    // 2. Multiple Choice (all selections must match exactly)
    if (q.type === 'multiple') {
        if (!Array.isArray(answer) || answer.length !== q.answers.length) return false;
        return answer.every(val => q.answers.includes(val)) && q.answers.every(val => answer.includes(val));
    }
    
    // 3. Grid Row (all sub-questions must be correct)
    if (q.type === 'grid') {
        const correctAnswersObj = q.answers;
        for (let pair of correctAnswersObj) {
            if (answer[pair.sub_question] !== pair.answer) {
                return false;
            }
        }
        return true;
    }
    
    // 4. Sorting Steps (all steps order must match answers array)
    if (q.type === 'sorting') {
        const userStepsSorted = Object.keys(answer).sort((a, b) => answer[a] - answer[b]);
        if (userStepsSorted.length !== q.answers.length) return false;
        return userStepsSorted.every((step, idx) => step === q.answers[idx]);
    }
    
    // 5. Matching Columns (all pairs must match correctly)
    if (q.type === 'matching') {
        const correctAnswersObj = q.answers;
        for (let pair of correctAnswersObj) {
            if (answer[pair.left] !== pair.right) {
                return false;
            }
        }
        return true;
    }
    
    // 6. Dropdown Grid
    if (q.type === 'dropdown_grid') {
        const correctAnswersObj = q.answers;
        for (let pair of correctAnswersObj) {
            if (answer[pair.sentence] !== pair.answer) {
                return false;
            }
        }
        return true;
    }
    
    // 7. Hotspot Question clicks
    if (q.type === 'hotspot') {
        if (!Array.isArray(answer) || answer.length !== q.answers.length) return false;
        
        const matchedFlags = new Set();
        for (let box of q.answers) {
            let found = false;
            for (let i = 0; i < answer.length; i++) {
                if (matchedFlags.has(i)) continue;
                const flag = answer[i];
                if (flag.x >= box.x_min && flag.x <= box.x_max && flag.y >= box.y_min && flag.y <= box.y_max) {
                    matchedFlags.add(i);
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }
    
    return false;
}

// Grading question wrapper
function gradeQuestion(q) {
    return isAllCorrect(q);
}

// Check how many questions were answered
function getAnsweredCount() {
    let count = 0;
    questions.forEach(q => {
        if (isAnswered(q)) count++;
    });
    return count;
}

function submitExam(force = false) {
    clearInterval(timerInterval);
    isSubmitted = true;
    
    // Close double-confirm modal if open
    document.getElementById('confirm-modal').classList.remove('show');
    
    // 1. Calculate score statistics
    let correctCount = 0;
    questions.forEach(q => {
        if (isAllCorrect(q)) {
            correctCount++;
        }
    });
    
    const totalQ = questions.length;
    const incorrectCount = totalQ - correctCount;
    
    // Scale score to standard 1000 points
    const finalScore = Math.round((correctCount / totalQ) * 1000);
    
    // 2. Display text summary
    document.getElementById('score-display').innerText = finalScore;
    document.getElementById('correct-count').innerText = `${correctCount} / ${totalQ}`;
    document.getElementById('incorrect-count').innerText = `${incorrectCount} / ${totalQ}`;
    
    // Spent Time
    const spentMinutes = Math.floor(timeSpent / 60);
    const spentSeconds = timeSpent % 60;
    document.getElementById('time-spent').innerText = `${String(spentMinutes).padStart(2, '0')}:${String(spentSeconds).padStart(2, '0')}`;
    
    // Evaluation rating
    const evalDisplay = document.getElementById('evaluation-text');
    if (finalScore >= 700) {
        evalDisplay.innerText = 'ĐẠT (PASS)';
        evalDisplay.className = 'stat-value text-success';
    } else {
        evalDisplay.innerText = 'CHƯA ĐẠT (FAIL)';
        evalDisplay.className = 'stat-value text-danger';
    }
    
    // 3. Render SVG radial progress ring path offset
    const ringFill = document.getElementById('ring-fill');
    const radius = 85;
    const circumference = 2 * Math.PI * radius; // ~534
    
    const percentage = correctCount / totalQ;
    const dashoffset = circumference * (1 - percentage);
    
    // Animate the fill offset after a short timeout so transition plays
    setTimeout(() => {
        ringFill.style.strokeDashoffset = dashoffset;
    }, 150);
    
    // 4. Update the sidebar cells to color correct/incorrect cells
    buildQuestionGrid();
    
    // 5. Hide the submit button in footer, show results view overlay
    document.getElementById('submit-btn').style.display = 'none';
    document.getElementById('results-panel').style.display = 'flex';
}

// ==========================================================================
// USER INTERACTIVE EVENT HANDLERS
// ==========================================================================
function setupEventListeners() {
    // 0. Welcome Screen Level Tabs Selector
    const levelTabs = document.querySelectorAll('.level-tab');
    levelTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const level = parseInt(tab.getAttribute('data-level'));
            switchLevel(level);
        });
    });

    // 0. Welcome Screen Card Switchers
    const modeFull = document.getElementById('mode-full');
    const modeTopic = document.getElementById('mode-topic');
    const modeRandom50 = document.getElementById('mode-random50');
    const topicSelect = document.getElementById('welcome-topic-select');
    
    if (modeFull && modeTopic && topicSelect) {
        modeFull.addEventListener('click', () => {
            selectedMode = 'full';
            modeFull.classList.add('active');
            modeTopic.classList.remove('active');
            if (modeRandom50) modeRandom50.classList.remove('active');
            topicSelect.value = '';
            selectedTopic = '';
            resetCustomSelect(); // Reset custom dropdown selection
        });
        
        modeTopic.addEventListener('click', () => {
            selectedMode = 'topic';
            modeTopic.classList.add('active');
            modeFull.classList.remove('active');
            if (modeRandom50) modeRandom50.classList.remove('active');
        });
        
        if (modeRandom50) {
            modeRandom50.addEventListener('click', () => {
                selectedMode = 'random50';
                modeRandom50.classList.add('active');
                modeFull.classList.remove('active');
                modeTopic.classList.remove('active');
                topicSelect.value = '';
                selectedTopic = '';
                resetCustomSelect(); // Reset custom dropdown selection
            });
        }
        
        topicSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                selectedMode = 'topic';
                selectedTopic = val;
                modeTopic.classList.add('active');
                modeFull.classList.remove('active');
                if (modeRandom50) modeRandom50.classList.remove('active');
            } else {
                selectedTopic = '';
            }
        });
    }

    // Custom select trigger and click outside close listeners
    const customSelectContainer = document.getElementById('custom-select-container');
    const customSelectTrigger = document.getElementById('custom-select-trigger');
    if (customSelectContainer && customSelectTrigger) {
        customSelectTrigger.addEventListener('click', (e) => {
            customSelectContainer.classList.toggle('open');
            e.stopPropagation();
        });
        document.addEventListener('click', (e) => {
            if (!customSelectContainer.contains(e.target)) {
                customSelectContainer.classList.remove('open');
            }
        });
    }
    
    // Welcome Screen Start Button
    const startQuizBtn = document.getElementById('start-quiz-btn');
    if (startQuizBtn) {
        startQuizBtn.addEventListener('click', () => {
            if (selectedMode === 'topic' && !selectedTopic) {
                alert('Vui lòng chọn một chủ đề ôn thi trong danh sách thả xuống!');
                return;
            }
            
            // Set up active questions
            let rawQuestions = [];
            if (selectedMode === 'full') {
                rawQuestions = [...allQuestions];
                timeLeft = 50 * 60; // 50 minutes
            } else if (selectedMode === 'random50') {
                const tempShuffled = [...allQuestions];
                for (let i = tempShuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tempShuffled[i], tempShuffled[j]] = [tempShuffled[j], tempShuffled[i]];
                }
                rawQuestions = tempShuffled.slice(0, 50);
                timeLeft = 50 * 60; // 50 minutes
            } else {
                rawQuestions = allQuestions.filter(q => q.topic === selectedTopic);
                timeLeft = Math.ceil(rawQuestions.length * 1.5) * 60; // 1.5 mins per question
            }
            
            // Deduplicate questions to prevent any duplicate entries from loading into the quiz session
            const uniqueQuestions = deduplicateQuestionsList(rawQuestions);
            
            // Randomize question sequence and option selections to prevent rote memorization
            questions = prepareQuestionsWithOptionsShuffled(uniqueQuestions);
            
            if (questions.length === 0) {
                alert('Không tìm thấy câu hỏi nào!');
                return;
            }
            
            // Hide welcome screen, show app container
            document.getElementById('welcome-screen').style.display = 'none';
            document.getElementById('app').style.display = 'flex';
            
            // Reset state & Start
            resetQuizState();
        });
    }

    // 1. Navigation Footer Buttons
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            renderQuestion(currentIndex);
        }
    });
    
    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentIndex < questions.length - 1) {
            currentIndex++;
            renderQuestion(currentIndex);
        }
    });
    
    // Bookmark Toggle button
    document.getElementById('flag-btn').addEventListener('click', () => {
        const q = questions[currentIndex];
        if (flaggedQuestions.has(q.id)) {
            flaggedQuestions.delete(q.id);
        } else {
            flaggedQuestions.add(q.id);
        }
        
        // Refresh question render & sidebar cell
        renderQuestion(currentIndex);
        updateCellState(q.id);
    });
    
    // 2. Question Filter Event Buttons in sidebar
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filterType = e.target.getAttribute('data-filter');
            filterQuestionGrid(filterType);
        });
    });
    
    // 3. Nộp bài - Submit triggers confirm dialog
    document.getElementById('submit-btn').addEventListener('click', () => {
        const done = getAnsweredCount();
        const total = questions.length;
        const left = total - done;
        
        document.getElementById('modal-summary-text').innerHTML = `Bạn đã hoàn thành <strong>${done} / ${total}</strong> câu hỏi.<br>Còn lại <strong>${left}</strong> câu hỏi chưa có câu trả lời.`;
        document.getElementById('confirm-modal').classList.add('show');
    });
    
    // Modal buttons actions
    document.getElementById('modal-cancel').addEventListener('click', () => {
        document.getElementById('confirm-modal').classList.remove('show');
    });
    
    document.getElementById('modal-confirm').addEventListener('click', () => {
        submitExam();
    });
    
    // 4. Score actions buttons - Return to Welcome Screen
    document.getElementById('restart-btn').addEventListener('click', () => {
        if (confirm('Bạn chắc chắn muốn hủy lượt làm bài hiện tại và quay về màn hình chào mừng?')) {
            returnToWelcomeScreen();
        }
    });
    
    // 4b. Header Home Button Click Action
    const headerHomeBtn = document.getElementById('header-home-btn');
    if (headerHomeBtn) {
        headerHomeBtn.addEventListener('click', () => {
            if (isSubmitted) {
                returnToWelcomeScreen();
            } else {
                if (confirm('Bạn có chắc chắn muốn hủy lượt làm bài hiện tại và quay về Trang chủ? (Tiến độ làm bài của bạn sẽ không được lưu.)')) {
                    returnToWelcomeScreen();
                }
            }
        });
    }

    // Header Logo Icon Click Action
    const headerLogoIcon = document.querySelector('.logo-icon-btn');
    if (headerLogoIcon) {
        headerLogoIcon.addEventListener('click', () => {
            if (isSubmitted) {
                returnToWelcomeScreen();
            } else {
                if (confirm('Bạn có chắc chắn muốn hủy lượt làm bài hiện tại và quay về Trang chủ? (Tiến độ làm bài của bạn sẽ không được lưu.)')) {
                    returnToWelcomeScreen();
                }
            }
        });
    }

    // Enter Review Mode
    document.getElementById('review-btn-action').addEventListener('click', () => {
        document.getElementById('results-panel').style.display = 'none';
        document.getElementById('review-banner-top').style.display = 'flex';
        
        // Set state as submitted and render the first page again
        currentIndex = 0;
        renderQuestion(currentIndex);
        
        // Disable submission button in footer, since we are in review
        document.getElementById('submit-btn').style.display = 'none';
    });
    
    // Exit Review Mode
    document.getElementById('exit-review-btn').addEventListener('click', () => {
        document.getElementById('review-banner-top').style.display = 'none';
        document.getElementById('results-panel').style.display = 'flex';
    });
}

/**
 * Return to welcome screen and reset welcome card inputs
 */
function returnToWelcomeScreen() {
    clearInterval(timerInterval);
    
    // Hide app container, show welcome screen
    document.getElementById('app').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
    
    // Reset welcome inputs
    selectedMode = 'full';
    selectedTopic = '';
    
    const modeFull = document.getElementById('mode-full');
    const modeTopic = document.getElementById('mode-topic');
    const modeRandom50 = document.getElementById('mode-random50');
    const topicSelect = document.getElementById('welcome-topic-select');
    
    if (modeFull && modeTopic && topicSelect) {
        modeFull.classList.add('active');
        modeTopic.classList.remove('active');
        if (modeRandom50) modeRandom50.classList.remove('active');
        topicSelect.value = '';
        resetCustomSelect(); // Reset custom dropdown UI selection
    }
}

// Update Top Progress bar percentages
function updateProgressBar() {
    const done = getAnsweredCount();
    const total = questions.length;
    const percentage = Math.round((done / total) * 100);
    
    document.getElementById('progress-text').innerText = `Tiến độ: ${done} / ${total} (${percentage}%)`;
    document.getElementById('progress-bar-fill').style.width = `${percentage}%`;
    document.getElementById('flagged-count').innerHTML = `<i class="fa-solid fa-flag text-warning"></i> ${flaggedQuestions.size}`;
}
