// --- DOM Elements ---
const loadingOverlay = document.getElementById('loadingOverlay');
const mainAppContent = document.getElementById('mainAppContent');
const authPage = document.getElementById('authPage');
const authTitle = document.getElementById('authTitle');
const authForm = document.getElementById('authForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const confirmPasswordField = document.getElementById('confirmPasswordField');
const confirmPasswordInput = document.getElementById('confirmPassword');
const authSubmit = document.getElementById('authSubmit');
const authMessage = document.getElementById('authMessage');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const logoutButton = document.getElementById('logoutButton');

const content = document.getElementById('content');
const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-button');
const pointsDisplay = document.getElementById('pointsDisplay');
const profilePoints = document.getElementById('profilePoints');
const withdrawPointsAvailable = document.getElementById('withdrawPointsAvailable');
const convertedAmountDisplay = document.getElementById('convertedAmountDisplay'); // New element
const catButton = document.getElementById('catButton');
const catImage = document.getElementById('catImage');
const energyLevelDisplay = document.getElementById('energyLevel');
const energyBar = document.getElementById('energyBar');
const taskList = document.getElementById('taskList');
const profileName = document.getElementById('profileName');
const profileUserId = document.getElementById('profileUserId');
const profileJoinDate = document.getElementById('profileJoinDate');
const profileReferral = document.getElementById('profileReferral');
const profilePic = document.getElementById('profilePic');
const withdrawAmountInput = document.getElementById('withdrawAmount');
const withdrawMethodSelect = document.getElementById('withdrawMethod');
const submitWithdrawalButton = document.getElementById('submitWithdrawal');
const withdrawMessage = document.getElementById('withdrawMessage');
const methodDetailsDiv = document.getElementById('methodDetails');
const detailFields = methodDetailsDiv.querySelectorAll('.detail-field');
const paypalEmailInput = document.getElementById('paypalEmail');
const bankAccountInput = document.getElementById('bankAccount');
const bankRoutingInput = document.getElementById('bankRouting');
const cryptoAddressInput = document.getElementById('cryptoAddress');
const upiIdInput = document.getElementById('upiId'); // New element

// --- Game State & Config ---
const API_URL = 'backend/api.php';
const MAX_ENERGY = 1000;
const ENERGY_REFILL_RATE = 2;
const ENERGY_PER_TAP = 1;
const POINTS_PER_TAP = 1;
const TASK_REWARD = 1000;
const COIN_TO_INR_RATE = 0.001; // 1000 Coins = 1 INR, so 10000 Coins = 10 INR (10000 * 0.001 = 10)

let userData = {
    userId: null,
    username: 'Guest',
    points: 0,
    energy: MAX_ENERGY,
    maxEnergy: MAX_ENERGY,
    lastEnergyUpdate: Date.now(),
    joinDate: null,
    tasks: [],
};

let authMode = 'login';

const CLIENT_TASKS = [
    { id: 0, title: "Watch Intro Video", description: `+${TASK_REWARD} Coins`, icon: 'youtube' },
    { id: 1, title: "Watch Gameplay Tutorial", description: `+${TASK_REWARD} Coins`, icon: 'youtube' },
    { id: 2, title: "Follow on X (Twitter)", description: `+${TASK_REWARD} Coins`, icon: 'generic' },
    { id: 3, title: "Subscribe to Channel", description: `+${TASK_REWARD} Coins`, icon: 'youtube' },
    { id: 4, title: "Join Discord Server", description: `+${TASK_REWARD} Coins`, icon: 'generic' },
];

// --- Utility Functions ---
async function fetchAPI(action, data = {}, method = 'POST') {
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (method === 'POST' || method === 'PUT') {
        options.body = JSON.stringify(data);
    } else if (method === 'GET') {
        const params = new URLSearchParams(data).toString();
        action += `?${params}`;
    }

    try {
        const response = await fetch(`${API_URL}?action=${action}`, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error during API call to ${action}:`, error);
        return { success: false, message: error.message };
    }
}

function showMessage(element, message, type = 'info') {
    element.textContent = message;
    element.className = `withdraw-message ${type}`;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
}

function applyTheme() {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    document.body.classList.toggle('dark', prefersDarkScheme.matches);

    prefersDarkScheme.addEventListener('change', (e) => {
        document.body.classList.toggle('dark', e.matches);
    });
}

// --- Authentication Logic ---
function showAuthPage() {
    mainAppContent.style.display = 'none';
    authPage.classList.add('active');
    authPage.style.display = 'flex';
    authMessage.style.display = 'none';
    usernameInput.value = '';
    passwordInput.value = '';
    confirmPasswordInput.value = '';
    toggleAuthModeDisplay('login');
    loadingOverlay.style.opacity = '0';
    setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
}

function showMainApp() {
    authPage.classList.remove('active');
    authPage.style.display = 'none';
    mainAppContent.style.display = 'flex';
    showPage('tapPage');
}

function toggleAuthModeDisplay(mode) {
    authMode = mode;
    if (authMode === 'login') {
        authTitle.textContent = 'Login';
        authSubmit.textContent = 'Login';
        confirmPasswordField.style.display = 'none';
        toggleAuthMode.textContent = "Don't have an account? Register";
    } else {
        authTitle.textContent = 'Register';
        authSubmit.textContent = 'Register';
        confirmPasswordField.style.display = 'block';
        toggleAuthMode.textContent = "Already have an account? Login";
    }
    authMessage.style.display = 'none';
}

async function handleAuthFormSubmit(event) {
    event.preventDefault();
    authSubmit.disabled = true;
    authMessage.style.display = 'none';

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        showMessage(authMessage, 'Username and password are required.', 'error');
        authSubmit.disabled = false;
        return;
    }

    if (authMode === 'register') {
        const confirmPassword = confirmPasswordInput.value;
        if (password !== confirmPassword) {
            showMessage(authMessage, 'Passwords do not match.', 'error');
            authSubmit.disabled = false;
            return;
        }
        if (password.length < 6) {
            showMessage(authMessage, 'Password must be at least 6 characters long.', 'error');
            authSubmit.disabled = false;
            return;
        }
    }

    const action = authMode;
    const result = await fetchAPI(action, { username, password });

    if (result.success) {
        if (authMode === 'register') {
            showMessage(authMessage, result.message + ' You can now log in.', 'success');
            toggleAuthModeDisplay('login');
        } else {
            showMessage(authMessage, result.message, 'success');
            userData = {
                userId: result.user.id,
                username: result.user.username,
                points: parseFloat(result.user.points),
                energy: parseFloat(result.user.energy),
                maxEnergy: parseFloat(result.user.max_energy),
                lastEnergyUpdate: parseFloat(result.user.last_energy_update) * 1000,
                joinDate: result.user.join_date,
                tasks: result.user.tasks ? JSON.parse(result.user.tasks) : [],
            };
            await initGameData();
            showMainApp();
        }
    } else {
        showMessage(authMessage, result.message, 'error');
    }
    authSubmit.disabled = false;
}

async function handleLogout() {
    const result = await fetchAPI('logout', {}, 'GET');
    if (result.success) {
        userData = {
            userId: null,
            username: 'Guest',
            points: 0,
            energy: MAX_ENERGY,
            maxEnergy: MAX_ENERGY,
            lastEnergyUpdate: Date.now(),
            joinDate: null,
            tasks: [],
        };
        clearInterval(window.energyRefillInterval);
        showAuthPage();
        showMessage(authMessage, 'You have been logged out.', 'info');
    } else {
        alert('Failed to log out: ' + result.message);
    }
}

// --- Initialization & Game Data Fetching ---
async function initApp() {
    console.log("Initializing App...");
    applyTheme();

    const authCheck = await fetchAPI('check_auth', {}, 'GET');

    if (authCheck.success && authCheck.user) {
        userData = {
            userId: authCheck.user.id,
            username: authCheck.user.username,
            points: parseFloat(authCheck.user.points),
            energy: parseFloat(authCheck.user.energy),
            maxEnergy: parseFloat(authCheck.user.max_energy),
            lastEnergyUpdate: parseFloat(authCheck.user.last_energy_update) * 1000,
            joinDate: authCheck.user.join_date,
            tasks: authCheck.user.tasks ? JSON.parse(authCheck.user.tasks) : [],
        };
        await initGameData();
        showMainApp();
    } else {
        console.log("Not logged in, showing auth page.");
        showAuthPage();
    }

    setupEventListeners();
    console.log("App Initialized.");
}

async function initGameData() {
    updatePointsDisplay();
    refillEnergy();
    updateEnergyDisplay();
    displayProfileInfo();
    renderTasks();
    updateConvertedAmountDisplay(); // Initial update for conversion display

    if (window.energyRefillInterval) clearInterval(window.energyRefillInterval);
    window.energyRefillInterval = setInterval(refillEnergy, 1000);

    setTimeout(() => {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => { loadingOverlay.style.display = 'none'; }, 300);
    }, 100);
}

// --- UI Update Functions ---
function updatePointsDisplay() {
    const formattedPoints = Math.floor(userData.points).toLocaleString('en-US');
    if (pointsDisplay) pointsDisplay.textContent = formattedPoints;
    if (profilePoints) profilePoints.textContent = formattedPoints;
    if (withdrawPointsAvailable) withdrawPointsAvailable.textContent = formattedPoints;
    if(withdrawAmountInput) withdrawAmountInput.max = Math.floor(userData.points);
    updateWithdrawButtonState();
    updateConvertedAmountDisplay(); // Also update conversion display
}

function updateEnergyDisplay() {
    const currentEnergy = Math.floor(userData.energy);
    const maxEnergy = userData.maxEnergy;
    if (energyLevelDisplay) energyLevelDisplay.textContent = `${currentEnergy.toLocaleString('en-US')} / ${maxEnergy.toLocaleString('en-US')}`;
    const energyPercentage = maxEnergy > 0 ? (currentEnergy / maxEnergy) * 100 : 0;
    if (energyBar) energyBar.style.width = `${energyPercentage}%`;
}

function displayProfileInfo() {
    profileName.textContent = userData.username || 'N/A';
    profileUserId.textContent = userData.userId || 'N/A';
    profilePic.src = '';
    profilePic.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="%23e0e0e0"/><path d="M50 42c-8.8 0-16 7.2-16 16s7.2 16 16 16 16-7.2 16-16-7.2-16-16-16zm0 28c-6.6 0-12-5.4-12-12s5.4-12 12-12 12 5.4 12 12-5.4 12-12 12z" fill="%23a0a0a0"/><path d="M76 64c0-11-8.5-20-19.3-21.7 1.1-1.6 1.8-3.5 1.8-5.6 0-5.5-4.5-10-10-10s-10 4.5-10 10c0 2.1.6 4 1.8 5.6C28.5 44 20 53 20 64v6h60v-6z" fill="%23a0a0a0"/></svg>')`;
    profileJoinDate.textContent = userData.joinDate ? new Date(userData.joinDate).toLocaleDateString() : 'N/A';
    profileReferral.textContent = `https://yourwebsite.com/register?ref=${userData.userId}`;
    profileReferral.onclick = () => {
        navigator.clipboard.writeText(profileReferral.textContent).then(() => {
            alert('Referral link copied!');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };
    profileReferral.style.cursor = 'pointer';
    profileReferral.style.color = 'var(--primary-color)';
}

function updateConvertedAmountDisplay() {
    const amountCoins = parseFloat(withdrawAmountInput.value) || 0;
    const amountINR = (amountCoins * COIN_TO_INR_RATE).toFixed(2);
    if (convertedAmountDisplay) {
        convertedAmountDisplay.textContent = `This will convert to: ${amountINR} INR`;
    }
}

// --- Navigation ---
function showPage(pageId) {
    let foundPage = false;
    pages.forEach(page => {
        const isActive = page.id === pageId;
        page.classList.toggle('active', isActive);
        if(isActive) foundPage = true;
    });

    if (!foundPage) {
        console.warn(`Page ID "${pageId}" not found, defaulting to tapPage.`);
        pageId = 'tapPage';
        document.getElementById('tapPage').classList.add('active');
    }

    navButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.page === pageId);
    });

    if (content) content.scrollTop = 0;

    switch(pageId) {
        case 'profilePage': displayProfileInfo(); updatePointsDisplay(); break;
        case 'taskPage': renderTasks(); updatePointsDisplay(); break;
        case 'withdrawPage': updatePointsDisplay(); updateWithdrawMethodDetails(); updateWithdrawButtonState(); break;
        case 'tapPage': default: updatePointsDisplay(); updateEnergyDisplay(); break;
    }
    console.log("Showing page:", pageId);
}

// --- Game Logic ---
async function handleTap(event) {
    if (!userData.userId) {
        showMessage(authMessage, 'Please log in to play!', 'error');
        showAuthPage();
        return;
    }

    if (userData.energy >= ENERGY_PER_TAP) {
        const now = Date.now();
        if (catButton.dataset.lastTap && (now - parseInt(catButton.dataset.lastTap) < 50)) return;
        catButton.dataset.lastTap = now.toString();

        userData.points += POINTS_PER_TAP;
        userData.energy = Math.max(0, userData.energy - ENERGY_PER_TAP);
        userData.lastEnergyUpdate = now;

        updatePointsDisplay();
        updateEnergyDisplay();

        const x = event.clientX || (catButton.offsetLeft + catButton.offsetWidth / 2);
        const y = event.clientY || (catButton.offsetTop + catButton.offsetHeight / 2);
        createFloatingText(`+${POINTS_PER_TAP}`, x, y);

        const result = await fetchAPI('tap', { points: POINTS_PER_TAP, energy_cost: ENERGY_PER_TAP });
        if (result.success) {
            userData.points = parseFloat(result.user.points);
            userData.energy = parseFloat(result.user.energy);
            userData.lastEnergyUpdate = parseFloat(result.user.last_energy_update) * 1000;
            updatePointsDisplay();
            updateEnergyDisplay();
        } else {
            console.error('Server tap error:', result.message);
            alert('Error tapping: ' + result.message);
            await initGameData();
        }

    } else {
        const energySection = document.querySelector('.energy-section');
        if(energySection) {
            energySection.classList.add('shake');
            setTimeout(() => energySection.classList.remove('shake'), 300);
        }
    }
}

function createFloatingText(text, x, y) {
    const feedback = document.createElement('div');
    feedback.textContent = text;
    feedback.className = 'tap-feedback';
    feedback.style.left = `${x}px`;
    feedback.style.top = `${y}px`;
    feedback.style.transform = 'translate(-50%, -100%)';

    document.body.appendChild(feedback);

    feedback.addEventListener('animationend', () => {
        if (feedback.parentNode) feedback.remove();
    });
}

function refillEnergy() {
    const now = Date.now();
    const timeElapsed = (now - userData.lastEnergyUpdate) / 1000;

    if (userData.energy < userData.maxEnergy && timeElapsed > 0) {
        const energyToRefill = timeElapsed * ENERGY_REFILL_RATE;
        const prevEnergyFloor = Math.floor(userData.energy);
        userData.energy = Math.min(userData.maxEnergy, userData.energy + energyToRefill);
        const currentEnergyFloor = Math.floor(userData.energy);

        if (currentEnergyFloor > prevEnergyFloor || (userData.energy === userData.maxEnergy && prevEnergyFloor < currentEnergyFloor)) {
            userData.lastEnergyUpdate = now;
            updateEnergyDisplay();
        }
    } else if (userData.energy >= userData.maxEnergy) {
        userData.lastEnergyUpdate = now;
    }
}


// --- Task Logic ---
function renderTasks() {
    taskList.innerHTML = '';
    CLIENT_TASKS.forEach((taskInfo) => {
        const userTaskData = userData.tasks.find(t => t.id === taskInfo.id);
        const isCompleted = userTaskData ? userTaskData.completed : false;
        const li = document.createElement('li');
        let iconSvg = getTaskIconSvg(taskInfo.icon);

        li.innerHTML = `
            <span class="task-icon ${taskInfo.icon}-icon">${iconSvg}</span>
            <div class="task-info">
                <div class="task-title">${taskInfo.title}</div>
                <div class="task-reward">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.99 14.71L10 15.03V9h2v5.03l2.01 1.68-.99 1z"/></svg>
                    ${taskInfo.description}
                </div>
            </div>
            <button class="task-button" data-task-id="${taskInfo.id}" ${isCompleted ? 'disabled' : ''}>
                ${isCompleted ? 'Claimed' : 'Go'}
            </button>
        `;

        const button = li.querySelector('.task-button');
        if (isCompleted) {
            button.classList.add('completed');
            button.textContent = 'Claimed';
        } else {
            button.addEventListener('click', () => completeTask(taskInfo.id));
        }
        taskList.appendChild(li);
    });
}

function getTaskIconSvg(iconType) {
    switch(iconType) {
        case 'youtube':
            return `<svg viewBox="0 0 24 24"><path d="M21.58 7.19c-.23-.86-.9-1.52-1.76-1.76C18.25 5 12 5 12 5s-6.25 0-7.82.43c-.86.24-1.52.9-1.76 1.76C2 8.75 2 12 2 12s0 3.25.43 4.81c.23.86.9 1.52 1.76 1.76C5.75 19 12 19 12 19s6.25 0 7.82-.43c.86-.24 1.52-.9 1.76-1.76C22 15.25 22 12 22 12s0-3.25-.42-4.81zM10 15V9l5.2 3-5.2 3z"/></svg>`;
        case 'generic': default:
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`;
    }
}

async function completeTask(taskId) {
    if (!userData.userId) {
        showMessage(authMessage, 'Please log in to complete tasks!', 'error');
        showAuthPage();
        return;
    }

    const taskIndex = userData.tasks.findIndex(t => t.id === taskId);
    const clientTaskInfo = CLIENT_TASKS.find(t => t.id === taskId);

    if (taskIndex === -1 || clientTaskInfo === undefined) {
        console.error("Task not found locally:", taskId);
        return;
    }

    if (userData.tasks[taskIndex].completed) {
        showMessage(taskMessage, 'Task already completed!', 'info');
        return;
    }

    const button = taskList.querySelector(`.task-button[data-task-id="${taskId}"]`);
    i