// Global state
let sessionId = 'default';
let userInfo = null;
let restaurants = [];
let selectedRestaurants = []; // Array to store multiple selected restaurants
let mealTimes = [];
let allMealTimes = []; // Store all meal times from all selected restaurants

// Global session management
let sessionManager = {
    refreshTimer: null,
    refreshInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
    lastRefreshTime: null,
    isRefreshing: false,
    sessionActive: false,
    refreshCount: 0
};

// localStorage utilities for restaurant selection
const STORAGE_KEY = 'welplan_selected_restaurants';

function saveSelectedRestaurants() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedRestaurants));
        console.log(`💾 Saved ${selectedRestaurants.length} selected restaurants to localStorage`);
    } catch (error) {
        console.warn('Failed to save restaurants to localStorage:', error);
    }
}

function loadSelectedRestaurants() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            selectedRestaurants = JSON.parse(saved);
            console.log(`📂 Loaded ${selectedRestaurants.length} restaurants from localStorage`);
            return selectedRestaurants;
        }
    } catch (error) {
        console.warn('Failed to load restaurants from localStorage:', error);
    }
    return [];
}

function clearStoredRestaurants() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('🗑️  Cleared selected restaurants from localStorage');
    } catch (error) {
        console.warn('Failed to clear restaurants from localStorage:', error);
    }
}

// API base URL
const API_BASE = '/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Set today's date as default for both tabs
    const today = new Date();
    const dateString = today.getFullYear().toString() + 
                      (today.getMonth() + 1).toString().padStart(2, '0') + 
                      today.getDate().toString().padStart(2, '0');
    document.getElementById('takeinMealDate').value = dateString;
    document.getElementById('takeoutMealDate').value = dateString;

    // Generate session ID
    sessionId = 'default'; // Use default session since credentials are in .env

    console.log('Welstory API Frontend initialized');
    
    // Load saved restaurant selections
    loadSelectedRestaurants();
    
    // Automatically authenticate
    await autoAuthenticate();
});

// Auto-authenticate function
async function autoAuthenticate() {
    try {
        showLoading('loginStatus', 'Checking authentication status');
        
        const result = await apiCall('/login');
        userInfo = result.userInfo;
        sessionId = result.sessionId;
        
        // Initialize session manager
        sessionManager.sessionActive = true;
        sessionManager.lastRefreshTime = new Date();
        
        showStatus('loginStatus', 'Automatically authenticated successfully!', 'success');
        displayUserInfo();
        
        // Start automatic session refresh
        startSessionAutoRefresh();
        
        // Start real-time status updater
        startStatusUpdater();
        
        // Update UI with saved restaurant selections
        if (selectedRestaurants.length > 0) {
            console.log(`📂 Loaded ${selectedRestaurants.length} restaurants from localStorage:`, selectedRestaurants.map(r => r.name));
            updateSelectedRestaurantsList();
            showStatus('selectedRestaurantsStatus', `Loaded ${selectedRestaurants.length} saved restaurant(s) from previous session`, 'success');
            
            // Small delay to ensure UI is ready
            setTimeout(async () => {
                console.log('🔄 Auto-fetching meal times for loaded restaurants...');
                await autoFetchMealTimes();
            }, 100);
        }
        
    } catch (error) {
        console.error('Auto-authentication error:', error);
        showStatus('loginStatus', `Authentication failed: ${error.message}. Check server credentials.`, 'error');
        sessionManager.sessionActive = false;
        updateSessionStatus();
    }
}

// Start automatic session refresh
function startSessionAutoRefresh() {
    // Clear any existing timer
    if (sessionManager.refreshTimer) {
        clearInterval(sessionManager.refreshTimer);
    }
    
    console.log(`🔄 Starting automatic session refresh every ${sessionManager.refreshInterval / 60000} minutes`);
    
    sessionManager.refreshTimer = setInterval(async () => {
        await performAutoRefresh();
    }, sessionManager.refreshInterval);
    
    // Update session status
    updateSessionStatus();
}

// Perform automatic session refresh
async function performAutoRefresh() {
    if (sessionManager.isRefreshing || !sessionManager.sessionActive) {
        return;
    }
    
    sessionManager.isRefreshing = true;
    sessionManager.refreshCount++;
    
    try {
        console.log(`🔄 Auto-refreshing session (attempt #${sessionManager.refreshCount})`);
        
        const result = await apiCall('/refresh');
        
        sessionManager.lastRefreshTime = new Date();
        sessionManager.isRefreshing = false;
        
        console.log(`✅ Session auto-refreshed successfully. Expires in ${result.expiresInMinutes} minutes`);
        
        // Update UI status
        showStatus('loginStatus', 
            `Session auto-refreshed #${sessionManager.refreshCount} at ${sessionManager.lastRefreshTime.toLocaleTimeString()}. Expires in ${result.expiresInMinutes}min`, 
            'success');
        
        updateSessionStatus();
        
    } catch (error) {
        console.error('❌ Auto-refresh failed:', error);
        sessionManager.isRefreshing = false;
        sessionManager.sessionActive = false;
        
        showStatus('loginStatus', 
            `Auto-refresh failed (attempt #${sessionManager.refreshCount}): ${error.message}`, 
            'error');
        
        updateSessionStatus();
        
        // Stop the timer if refresh fails
        if (sessionManager.refreshTimer) {
            clearInterval(sessionManager.refreshTimer);
            sessionManager.refreshTimer = null;
        }
    }
}

// Start real-time status updater (updates every minute)
function startStatusUpdater() {
    updateSessionStatus(); // Initial update
    
    // Update status every minute
    setInterval(() => {
        updateSessionStatus();
    }, 60000); // 60 seconds
}

// Update session status display
function updateSessionStatus() {
    const now = new Date();
    const timeSinceRefresh = sessionManager.lastRefreshTime ? 
        Math.floor((now - sessionManager.lastRefreshTime) / 1000 / 60) : 0;
    const nextRefreshIn = Math.max(0, Math.floor(sessionManager.refreshInterval / 1000 / 60 - timeSinceRefresh));
    
    const statusElement = document.getElementById('sessionStatus');
    if (statusElement) {
        let statusText = '';
        let statusClass = 'info';
        
        if (sessionManager.sessionActive) {
            if (sessionManager.isRefreshing) {
                statusText = '🔄 Refreshing session...';
                statusClass = 'info';
            } else if (sessionManager.refreshTimer) {
                statusText = `✅ Auto-refresh ON | Count: ${sessionManager.refreshCount} | Next: ${nextRefreshIn}min`;
                statusClass = 'success';
            } else {
                statusText = `⚠️ Auto-refresh OFF | Count: ${sessionManager.refreshCount} | Manual only`;
                statusClass = 'info';
            }
        } else {
            statusText = '❌ Session inactive - authentication required';
            statusClass = 'error';
        }
        
        statusElement.innerHTML = `<div class="status ${statusClass}">Session: ${statusText}</div>`;
    }
}

// Enhanced error handling for API calls
async function safeApiCall(endpoint, data = {}) {
    try {
        return await apiCall(endpoint, data);
    } catch (error) {
        // Handle specific session errors
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
            console.error('🔒 Session expired, marking as inactive');
            sessionManager.sessionActive = false;
            updateSessionStatus();
            showStatus('loginStatus', 'Session expired. Please refresh or re-authenticate.', 'error');
        }
        throw error;
    }
}

// Function to determine default meal time based on current time
function getDefaultMealTime(mealTimes) {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Define time ranges for meals (Korean cafeteria typical hours)
    // Breakfast: 7:00 - 9:30
    // Lunch: 11:30 - 14:00  
    // Dinner: 17:00 - 19:30
    
    let preferredMealType;
    
    if (currentHour >= 7 && currentHour < 10) {
        preferredMealType = 'breakfast';
    } else if (currentHour >= 10 && currentHour < 15) {
        preferredMealType = 'lunch';
    } else if (currentHour >= 15 && currentHour < 20) {
        preferredMealType = 'dinner';
    } else {
        // Default to lunch for other times
        preferredMealType = 'lunch';
    }
    
    // Try to find a meal time that matches the preferred type
    const mealTypeKeywords = {
        breakfast: ['아침', 'breakfast', '조식', '브런치', 'brunch'],
        lunch: ['점심', 'lunch', '중식'],
        dinner: ['저녁', 'dinner', '석식', '야식']
    };
    
    const keywords = mealTypeKeywords[preferredMealType];
    
    // First, try to find exact match
    for (const mealTime of mealTimes) {
        const mealName = mealTime.name.toLowerCase();
        if (keywords.some(keyword => mealName.includes(keyword))) {
            return mealTime;
        }
    }
    
    // If no exact match, return the first available meal time
    return mealTimes.length > 0 ? mealTimes[0] : null;
}

// Utility functions
function showStatus(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="status ${type}">${message}</div>`;
}

function clearStatus(elementId) {
    const element = document.getElementById(elementId);
    element.innerHTML = '';
}

function showLoading(elementId, message = 'Loading') {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="loading">${message}</div>`;
}

// API helper function
async function apiCall(endpoint, data = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, sessionId })
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
        throw new Error(result.error || 'API call failed');
    }
    
    return result;
}

// Check authentication status
window.checkAuth = async function() {
    await autoAuthenticate();
};

window.refreshSession = async function() {
    if (!userInfo) {
        showStatus('loginStatus', 'Please login first', 'error');
        return;
    }

    try {
        showLoading('loginStatus', 'Manually refreshing session');
        
        const result = await apiCall('/refresh');
        
        // Update session manager
        sessionManager.lastRefreshTime = new Date();
        sessionManager.refreshCount++;
        
        showStatus('loginStatus', `Manual session refresh successful! Expires in ${result.expiresInMinutes} minutes`, 'success');
        updateSessionStatus();
        
    } catch (error) {
        console.error('Manual session refresh error:', error);
        showStatus('loginStatus', `Manual session refresh failed: ${error.message}`, 'error');
        sessionManager.sessionActive = false;
        updateSessionStatus();
    }
};

// Toggle auto-refresh functionality
window.toggleAutoRefresh = function() {
    if (sessionManager.refreshTimer) {
        // Stop auto-refresh
        clearInterval(sessionManager.refreshTimer);
        sessionManager.refreshTimer = null;
        showStatus('loginStatus', 'Auto-refresh stopped', 'info');
        console.log('🛑 Auto-refresh disabled');
    } else {
        // Start auto-refresh
        if (sessionManager.sessionActive) {
            startSessionAutoRefresh();
            showStatus('loginStatus', `Auto-refresh started (every ${sessionManager.refreshInterval / 60000} minutes)`, 'success');
        } else {
            showStatus('loginStatus', 'Cannot start auto-refresh: session inactive', 'error');
        }
    }
    updateSessionStatus();
};

function displayUserInfo() {
    if (!userInfo) return;

    const userInfoSection = document.getElementById('userInfoSection');
    const userInfoDiv = document.getElementById('userInfo');
    
    userInfoDiv.innerHTML = `
        <p><strong>User ID:</strong> ${userInfo.id}</p>
        <p><strong>Business:</strong> ${userInfo.bizName}</p>
        <p><strong>Gender:</strong> ${userInfo.gender}</p>
    `;
    
    userInfoSection.classList.remove('hidden');
}

// Restaurant search functionality
window.searchRestaurants = async function() {
    const searchQuery = document.getElementById('restaurantSearch').value;

    if (!searchQuery) {
        showStatus('searchStatus', 'Please enter a restaurant name to search', 'error');
        return;
    }

    if (!userInfo) {
        showStatus('searchStatus', 'Please login first', 'error');
        return;
    }

    try {
        showLoading('searchStatus', 'Searching restaurants');
        
        const result = await apiCall('/restaurants/search', {
            searchQuery: searchQuery
        });

        restaurants = result.restaurants;
        
        if (restaurants.length === 0) {
            showStatus('searchStatus', 'No restaurants found', 'info');
            document.getElementById('restaurantResults').innerHTML = '';
            return;
        }

        showStatus('searchStatus', `Found ${restaurants.length} restaurant(s)`, 'success');
        displayRestaurants();
        
    } catch (error) {
        console.error('Restaurant search error:', error);
        showStatus('searchStatus', `Search failed: ${error.message}`, 'error');
    }
};

function displayRestaurants() {
    const resultsDiv = document.getElementById('restaurantResults');
    
    const restaurantCards = restaurants.map((restaurant, index) => {
        const isSelected = selectedRestaurants.some(r => r.id === restaurant.id);
        return `
        <div class="restaurant-card">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <input type="checkbox" id="restaurant-${index}" ${isSelected ? 'checked' : ''} 
                       onchange="toggleRestaurantSelection(${index})" style="margin-right: 10px; transform: scale(1.2);">
                <h3 style="margin: 0;">${restaurant.name}</h3>
            </div>
            <p><strong>ID:</strong> ${restaurant.id}</p>
            <p><strong>Description:</strong> ${restaurant.description}</p>
            <div style="margin-top: 15px;">
                <button class="btn" onclick="registerRestaurant(${index})">Register</button>
                <button class="btn" onclick="unregisterRestaurant(${index})">Unregister</button>
                <button class="btn" onclick="checkRegistration(${index})">Check Registration</button>
            </div>
        </div>
    `;
    }).join('');
    
    resultsDiv.innerHTML = restaurantCards;
}

// Toggle restaurant selection
window.toggleRestaurantSelection = async function(index) {
    const restaurant = restaurants[index];
    const existingIndex = selectedRestaurants.findIndex(r => r.id === restaurant.id);
    
    let wasAdded = false;
    
    if (existingIndex >= 0) {
        // Remove from selection
        selectedRestaurants.splice(existingIndex, 1);
        showStatus('searchStatus', `Removed ${restaurant.name} from selection`, 'info');
    } else {
        // Add to selection
        selectedRestaurants.push(restaurant);
        showStatus('searchStatus', `Added ${restaurant.name} to selection`, 'success');
        wasAdded = true;
    }
    
    // Save to localStorage
    saveSelectedRestaurants();
    
    updateSelectedRestaurantsList();
    
    // Auto-fetch meal times when restaurants are selected
    if (selectedRestaurants.length > 0) {
        await autoFetchMealTimes();
        
        // Auto-switch disabled - users can manually switch to Menu & Meals tab
        // if (selectedRestaurants.length === 1 && wasAdded) {
        //     switchTab('menus');
        // }
    }
};

// Update the selected restaurants display
function updateSelectedRestaurantsList() {
    const listDiv = document.getElementById('selectedRestaurantsList');
    
    if (selectedRestaurants.length === 0) {
        listDiv.innerHTML = '<p>No restaurants selected. Search and select restaurants above.</p>';
        document.getElementById('selectedRestaurantsStatus').innerHTML = '';
        return;
    }
    
    const restaurantCards = selectedRestaurants.map((restaurant, index) => `
        <div class="restaurant-card">
            <h3>${restaurant.name}</h3>
            <p><strong>ID:</strong> ${restaurant.id}</p>
            <p><strong>Description:</strong> ${restaurant.description}</p>
            <button class="btn" onclick="removeFromSelection('${restaurant.id}')">Remove from Selection</button>
        </div>
    `).join('');
    
    listDiv.innerHTML = restaurantCards;
    
    showStatus('selectedRestaurantsStatus', `${selectedRestaurants.length} restaurant(s) selected`, 'success');
}

// Update select dropdowns for meal operations
// Restaurant select dropdowns are no longer needed since meal times are auto-fetched

// Remove restaurant from selection
window.removeFromSelection = async function(restaurantId) {
    const index = selectedRestaurants.findIndex(r => r.id === restaurantId);
    if (index >= 0) {
        const restaurant = selectedRestaurants[index];
        selectedRestaurants.splice(index, 1);
        showStatus('selectedRestaurantsStatus', `Removed ${restaurant.name} from selection`, 'info');
        
        // Save to localStorage
        saveSelectedRestaurants();
        
        // Update displays
        updateSelectedRestaurantsList();
        updateRestaurantSelects();
        displayRestaurants(); // Refresh to update checkboxes
        
        // Auto-fetch meal times for remaining restaurants
        await autoFetchMealTimes();
    }
};

// Clear all selected restaurants
window.clearSelectedRestaurants = function() {
    selectedRestaurants = [];
    allMealTimes = [];
    
    // Clear from localStorage
    clearStoredRestaurants();
    
    updateSelectedRestaurantsList();
    updateMealTimeSelect();
    displayRestaurants(); // Refresh to update checkboxes
    showStatus('selectedRestaurantsStatus', 'All selections cleared', 'info');
};

// Auto-fetch meal times from all selected restaurants
async function autoFetchMealTimes() {
    if (selectedRestaurants.length === 0) {
        allMealTimes = [];
        updateMealTimeSelect();
        return;
    }
    
    console.log(`🔄 Auto-fetching meal times for ${selectedRestaurants.length} restaurant(s)...`);
    
    try {
        const uniqueMealTimes = new Map(); // Use Map to avoid duplicates
        let totalFetched = 0;
        let successCount = 0;
        let errorCount = 0;
        
        // Fetch meal times from each selected restaurant
        for (const restaurant of selectedRestaurants) {
            try {
                console.log(`⏳ Fetching meal times for ${restaurant.name}...`);
                
                // Ensure restaurant object has required fields
                if (!restaurant.id || !restaurant.name) {
                    console.warn(`⚠️  Invalid restaurant data for ${restaurant.name || 'unknown'}: missing id or name`);
                    errorCount++;
                    continue;
                }
                
                const result = await apiCall('/restaurants/meal-times', {
                    restaurantData: restaurant
                });
                
                if (result.success && result.mealTimes && result.mealTimes.length > 0) {
                    // Add unique meal times
                    result.mealTimes.forEach(mealTime => {
                        if (!uniqueMealTimes.has(mealTime.id)) {
                            uniqueMealTimes.set(mealTime.id, mealTime);
                            totalFetched++;
                        }
                    });
                    successCount++;
                    console.log(`✅ Successfully fetched ${result.mealTimes.length} meal times from ${restaurant.name}`);
                } else {
                    console.warn(`⚠️  No meal times returned from ${restaurant.name}`);
                    errorCount++;
                }
                
            } catch (error) {
                console.error(`❌ Failed to get meal times for ${restaurant.name}:`, error.message);
                errorCount++;
            }
        }
        
        // Convert Map back to array
        allMealTimes = Array.from(uniqueMealTimes.values());
        
        console.log(`📊 Meal times summary: ${successCount} successful, ${errorCount} failed, ${totalFetched} unique meal times found`);
        
        if (allMealTimes.length === 0) {
            console.warn('⚠️  No meal times available from any selected restaurants');
            // Don't clear existing meal times if we have fetch errors - might be temporary
            if (errorCount === 0) {
                // Only clear if no errors (restaurants genuinely have no meal times)
                updateMealTimeSelect();
            }
            return;
        }
        
        // Get default meal time based on current time
        const defaultMealTime = getDefaultMealTime(allMealTimes);
        
        updateMealTimeSelect();
        console.log(`🍽️  Updated meal time selectors with ${allMealTimes.length} options`);
        
        // Set default selection for both tabs
        if (defaultMealTime) {
            const takeinSelect = document.getElementById('takeinMealTimeId');
            const takeoutSelect = document.getElementById('takeoutMealTimeId');
            if (takeinSelect) takeinSelect.value = defaultMealTime.id;
            if (takeoutSelect) takeoutSelect.value = defaultMealTime.id;
            console.log(`⏰ Set default meal time: ${defaultMealTime.name}`);
        }
        
    } catch (error) {
        console.error('❌ Auto-fetch meal times error:', error);
        // Don't clear existing meal times on error
    }
}

window.registerRestaurant = async function(index) {
    const restaurant = restaurants[index];
    
    try {
        showLoading('searchStatus', 'Registering restaurant');
        await apiCall('/restaurants/register', {
            restaurantData: restaurant
        });
        showStatus('searchStatus', `Successfully registered ${restaurant.name}`, 'success');
    } catch (error) {
        console.error('Registration error:', error);
        showStatus('searchStatus', `Registration failed: ${error.message}`, 'error');
    }
};

window.unregisterRestaurant = async function(index) {
    const restaurant = restaurants[index];
    
    try {
        showLoading('searchStatus', 'Unregistering restaurant');
        await apiCall('/restaurants/unregister', {
            restaurantData: restaurant
        });
        showStatus('searchStatus', `Successfully unregistered ${restaurant.name}`, 'success');
    } catch (error) {
        console.error('Unregistration error:', error);
        showStatus('searchStatus', `Unregistration failed: ${error.message}`, 'error');
    }
};

window.checkRegistration = async function(index) {
    const restaurant = restaurants[index];
    
    try {
        showLoading('searchStatus', 'Checking registration');
        const result = await apiCall('/restaurants/check-registration', {
            restaurantId: restaurant.id
        });
        const status = result.isRegistered ? 'registered' : 'not registered';
        showStatus('searchStatus', `${restaurant.name} is ${status}`, 'info');
    } catch (error) {
        console.error('Registration check error:', error);
        showStatus('searchStatus', `Registration check failed: ${error.message}`, 'error');
    }
};

// Meal times are now automatically fetched when restaurants are selected

function displayMealTimes() {
    const resultsDiv = document.getElementById('mealTimesResults');
    
    const mealTimeCards = allMealTimes.map(mealTime => `
        <div class="meal-card">
            <h3>${mealTime.name}</h3>
            <p><strong>ID:</strong> ${mealTime.id}</p>
        </div>
    `).join('');
    
    resultsDiv.innerHTML = mealTimeCards;
}

function updateMealTimeSelect() {
    const takeinSelect = document.getElementById('takeinMealTimeId');
    const takeoutSelect = document.getElementById('takeoutMealTimeId');
    
    // Only update if we have meal times or if selects are empty
    if (allMealTimes.length > 0 || (takeinSelect && takeinSelect.children.length <= 1)) {
        const optionsHTML = '<option value="">Select a meal time</option>' + 
            allMealTimes.map(mealTime => 
                `<option value="${mealTime.id}">${mealTime.name}</option>`
            ).join('');
        
        if (takeinSelect) {
            // Preserve current selection if possible
            const currentValue = takeinSelect.value;
            takeinSelect.innerHTML = optionsHTML;
            if (currentValue && allMealTimes.some(mt => mt.id === currentValue)) {
                takeinSelect.value = currentValue;
            }
        }
        
        if (takeoutSelect) {
            // Preserve current selection if possible
            const currentValue = takeoutSelect.value;
            takeoutSelect.innerHTML = optionsHTML;
            if (currentValue && allMealTimes.some(mt => mt.id === currentValue)) {
                takeoutSelect.value = currentValue;
            }
        }
    }
}

// General meals functionality
async function fetchMeals(dateStr, mealTimeId, mealType = 'all', statusElementId, resultsElementId) {
    const showAllRestaurants = true
    
    if (!dateStr || !/^\d{8}$/.test(dateStr)) {
        showStatus(statusElementId, 'Please enter a valid date in YYYYMMDD format', 'error');
        return;
    }
    
    if (!mealTimeId) {
        showStatus(statusElementId, 'Please select a meal time', 'error');
        return;
    }

    if (selectedRestaurants.length === 0) {
        showStatus(statusElementId, 'No restaurants selected. Please select restaurants first.', 'error');
        return;
    }

    try {
        showLoading(statusElementId, `Getting ${mealType === 'takein' ? 'Take In' : mealType === 'takeout' ? 'Take Out' : ''} meals`);
        
        let allMeals = [];
        
        if (showAllRestaurants) {
            // Get meals from all selected restaurants
            for (const restaurant of selectedRestaurants) {
                try {
                    const result = await apiCall('/restaurants/meals', {
                        restaurantData: restaurant,
                        date: dateStr,
                        mealTimeId: mealTimeId
                    });
                    
                    // Add restaurant info to each meal for identification
                    const mealsWithRestaurant = result.meals.map(meal => ({
                        ...meal,
                        restaurantName: restaurant.name
                    }));
                    
                    allMeals.push(...mealsWithRestaurant);
                } catch (error) {
                    console.warn(`Failed to get meals for ${restaurant.name}:`, error.message);
                }
            }
        } else {
            // Get meals from selected restaurant only
            const restaurantIndex = document.getElementById('selectedRestaurantForMeals').value;
            
            if (!restaurantIndex) {
                showStatus('mealsStatus', 'Please select a restaurant or check "Show meals from all selected restaurants"', 'error');
                return;
            }
            
            const restaurant = selectedRestaurants[parseInt(restaurantIndex)];
            const result = await apiCall('/restaurants/meals', {
                restaurantData: restaurant,
                date: dateStr,
                mealTimeId: mealTimeId
            });
            
            allMeals = result.meals.map(meal => ({
                ...meal,
                restaurantName: restaurant.name
            }));
        }
        
        if (allMeals.length === 0) {
            showStatus('mealsStatus', 'No meals available for the selected date and time', 'info');
            document.getElementById('mealsResults').innerHTML = '';
            return;
        }

        // Filter meals based on type
        let filteredMeals = allMeals;
        if (mealType === 'takein') {
            // Take In: exclude meals with "T/O" prefix in course name
            filteredMeals = allMeals.filter(meal => 
                !meal.menuCourseName || !meal.menuCourseName.startsWith('T/O')
            );
        } else if (mealType === 'takeout') {
            // Take Out: only include meals with "T/O" prefix in course name
            filteredMeals = allMeals.filter(meal => 
                meal.menuCourseName && meal.menuCourseName.startsWith('T/O')
            );
        }
        
        const typeText = mealType === 'takein' ? 'Take In' : mealType === 'takeout' ? 'Take Out' : '';
        
        if (filteredMeals.length === 0) {
            showStatus(statusElementId, `No ${typeText} meals found for the selected criteria`, 'info');
            document.getElementById(resultsElementId).innerHTML = `<p>No ${typeText} meals found.</p>`;
            return;
        }
        
        const restaurantCount = showAllRestaurants ? selectedRestaurants.length : 1;
        showStatus(statusElementId, `Found ${filteredMeals.length} ${typeText} meal(s) from ${restaurantCount} restaurant(s)`, 'success');
        displayMeals(filteredMeals, resultsElementId);
        
    } catch (error) {
        console.error('Meals error:', error);
        showStatus(statusElementId, `Failed to get meals: ${error.message}`, 'error');
    }
}

// Take In Meals functionality
window.getTakeinMeals = async function() {
    const dateStr = document.getElementById('takeinMealDate').value;
    const mealTimeId = document.getElementById('takeinMealTimeId').value;
    
    await fetchMeals(dateStr, mealTimeId, 'takein', 'takeinMealsStatus', 'takeinMealsResults');
};

// Take Out Meals functionality
window.getTakeoutMeals = async function() {
    const dateStr = document.getElementById('takeoutMealDate').value;
    const mealTimeId = document.getElementById('takeoutMealTimeId').value;
    
    await fetchMeals(dateStr, mealTimeId, 'takeout', 'takeoutMealsStatus', 'takeoutMealsResults');
};

// Fetch nutrition data for multiple meals using bulk API
async function fetchNutritionForMeals(meals) {
    console.log(`🚀 Using bulk nutrition API for ${meals.length} meals`);
    
    // Filter out meals that already have nutrition data
    const mealsNeedingNutrition = meals.filter(meal => !meal.nutritionTotals);
    const mealsWithExistingNutrition = meals.filter(meal => meal.nutritionTotals);
    
    console.log(`📊 ${mealsNeedingNutrition.length} meals need nutrition data, ${mealsWithExistingNutrition.length} already have it`);
    
    if (mealsNeedingNutrition.length === 0) {
        return meals; // All meals already have nutrition data
    }
    
    try {
        // Use bulk API to fetch nutrition for multiple meals at once
        const result = await apiCall('/meals/nutrition/bulk', {
            mealsData: mealsNeedingNutrition
        });
        
        if (result.success) {
            console.log(`✅ Bulk nutrition API success: ${result.successfulMeals}/${result.totalMeals} meals processed, ${result.cacheHits} from cache`);
            
            // Process the bulk results
            const processedMeals = [...mealsWithExistingNutrition]; // Start with meals that already have nutrition
            
            mealsNeedingNutrition.forEach((meal, index) => {
                const nutritionResult = result.results.find(r => r.mealIndex === index);
                
                if (nutritionResult && nutritionResult.success && nutritionResult.nutritionData && nutritionResult.nutritionData.length > 0) {
                    // Calculate totals
                    const nutritionTotals = {
                        calories: nutritionResult.nutritionData.reduce((sum, item) => sum + (item.calorie || 0), 0),
                        carbs: nutritionResult.nutritionData.reduce((sum, item) => sum + (item.carbohydrate || 0), 0),
                        sugar: nutritionResult.nutritionData.reduce((sum, item) => sum + (item.sugar || 0), 0),
                        fiber: nutritionResult.nutritionData.reduce((sum, item) => sum + (item.fiber || 0), 0),
                        fat: nutritionResult.nutritionData.reduce((sum, item) => sum + (item.fat || 0), 0),
                        protein: nutritionResult.nutritionData.reduce((sum, item) => sum + (item.protein || 0), 0)
                    };
                    
                    processedMeals.push({
                        ...meal,
                        nutritionTotals,
                        nutritionData: nutritionResult.nutritionData
                    });
                    
                    console.log(`✅ Nutrition processed for ${meal.name}: ${nutritionTotals.calories} calories${nutritionResult.cached ? ' (cached)' : ''}`);
                } else {
                    console.warn(`⚠️  No nutrition data for ${meal.name}:`, nutritionResult?.error || 'Unknown error');
                    processedMeals.push({
                        ...meal,
                        nutritionTotals: null
                    });
                }
            });
            
            // Sort meals back to original order
            const sortedMeals = meals.map(originalMeal => {
                return processedMeals.find(processed => 
                    processed.name === originalMeal.name && 
                    processed.hallNo === originalMeal.hallNo &&
                    processed.date === originalMeal.date &&
                    processed.mealTimeId === originalMeal.mealTimeId
                ) || originalMeal;
            });
            
            return sortedMeals;
            
        } else {
            console.error('❌ Bulk nutrition API failed:', result.error);
            // Fall back to meals without nutrition data
            return meals.map(meal => ({
                ...meal,
                nutritionTotals: null
            }));
        }
        
    } catch (error) {
        console.error('❌ Bulk nutrition fetch failed:', error.message);
        // Fall back to meals without nutrition data
        return meals.map(meal => ({
            ...meal,
            nutritionTotals: null
        }));
    }
}

async function displayMeals(meals, resultsElementId = 'mealsResults') {
    const resultsDiv = document.getElementById(resultsElementId);
    
    if (meals.length === 0) {
        resultsDiv.innerHTML = '<p>No meals found for the selected criteria.</p>';
        return;
    }
    
    // Check if this is Take In meals and should show nutrition
    const isTakeInMeals = resultsElementId === 'takeinMealsResults';
    
    // If Take In meals, fetch nutrition data for all meals
    let mealsWithNutrition = meals;
    if (isTakeInMeals) {
        console.log('🍴 Fetching nutrition data for Take In meals...');
        // Show enhanced loading message
        resultsDiv.innerHTML = `
            <div class="nutrition-loading">
                <div class="loading">⚡ Loading ${meals.length} meals with nutrition data using bulk API...</div>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                    This may take a few seconds for the first load. Subsequent loads will be much faster thanks to caching.
                </p>
            </div>
        `;
        mealsWithNutrition = await fetchNutritionForMeals(meals);
    }
    
    const nutritionColumns = isTakeInMeals ? `
        <th class="nutrition-header">Calories</th>
        <th class="nutrition-header">Carbs (g)</th>
        <th class="nutrition-header">Sugar (g)</th>
        <th class="nutrition-header">Fiber (g)</th>
        <th class="nutrition-header">Fat (g)</th>
        <th class="nutrition-header">Protein (g)</th>
    ` : '';
    
    const tableHTML = `
        <table class="meals-table">
            <thead>
                <tr>
                    <th>Restaurant</th>
                    <th>Meal Name</th>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Set</th>
                    <th>Hall</th>
                    <th>Image</th>
                    ${nutritionColumns}
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${mealsWithNutrition.map((meal, index) => {
                    const nutritionCells = isTakeInMeals && meal.nutritionTotals ? `
                        <td class="nutrition-col nutrition-calories">${meal.nutritionTotals.calories || 0}</td>
                        <td class="nutrition-col nutrition-carbs">${meal.nutritionTotals.carbs || 0}</td>
                        <td class="nutrition-col nutrition-sugar">${meal.nutritionTotals.sugar || 0}</td>
                        <td class="nutrition-col nutrition-fiber">${meal.nutritionTotals.fiber || 0}</td>
                        <td class="nutrition-col nutrition-fat">${meal.nutritionTotals.fat || 0}</td>
                        <td class="nutrition-col nutrition-protein">${meal.nutritionTotals.protein || 0}</td>
                    ` : isTakeInMeals ? `
                        <td colspan="6" class="nutrition-loading">Nutrition data unavailable</td>
                    ` : '';
                    
                    return `
                    <tr>
                        <td>
                            <span class="restaurant-badge">
                                📍 ${meal.restaurantName || 'Unknown'}
                            </span>
                        </td>
                        <td>
                            <strong>${meal.name}</strong>
                            ${meal.subMenuTxt ? `<br><small class="meal-description">${meal.subMenuTxt}</small>` : ''}
                        </td>
                        <td>${meal.menuCourseName}</td>
                        <td>${meal.menuCourseType}</td>
                        <td>${meal.setName || '-'}</td>
                        <td>${meal.hallNo}</td>
                        <td class="meal-image-cell">
                            ${meal.photoUrl ? `<img class="meal-image-thumb" src="${meal.photoUrl}" alt="${meal.name}" onerror="this.style.display='none'" onclick="showImageModal('${meal.photoUrl}', '${meal.name}')">` : '-'}
                        </td>
                        ${nutritionCells}
                        <td>
                            <button class="btn btn-small" onclick="getNutritionInfo(${index})" title="Get Nutrition Info">📊</button>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    resultsDiv.innerHTML = tableHTML;
    
    // Store meals globally for nutrition access
    window.currentMeals = mealsWithNutrition;
    // Store which results area this is for nutrition display
    window.currentMealsResultsId = resultsElementId;
}

// Simple image modal function
window.showImageModal = function(imageUrl, mealName) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <img src="${imageUrl}" alt="${mealName}" style="max-width: 100%; max-height: 80vh;">
            <p style="text-align: center; margin-top: 10px; font-weight: bold;">${mealName}</p>
        </div>
    `;
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };
    
    document.body.appendChild(modal);
};

// Nutrition functionality
window.getNutritionInfo = async function(mealIndex) {
    const meal = window.currentMeals[mealIndex];
    
    // Determine which tab we're in based on the current results area
    let nutritionStatusId = 'nutritionStatus';
    let nutritionResultsId = 'nutritionResults';
    
    if (window.currentMealsResultsId === 'takeinMealsResults') {
        nutritionStatusId = 'takeinNutritionStatus';
        nutritionResultsId = 'takeinNutritionResults';
    } else if (window.currentMealsResultsId === 'takeoutMealsResults') {
        nutritionStatusId = 'takeoutNutritionStatus';
        nutritionResultsId = 'takeoutNutritionResults';
    }
    
    try {
        showLoading(nutritionStatusId, 'Getting nutritional information');
        
        const result = await apiCall('/meals/nutrition', {
            mealData: meal
        });
        
        if (result.nutritionData.length === 0) {
            showStatus(nutritionStatusId, 'No nutritional information available', 'info');
            document.getElementById(nutritionResultsId).innerHTML = '';
            return;
        }

        showStatus(nutritionStatusId, `Found nutrition data for ${result.nutritionData.length} menu item(s)`, 'success');
        displayNutritionInfo(result.mealName, result.nutritionData, nutritionResultsId);
        
    } catch (error) {
        console.error('Nutrition error:', error);
        showStatus(nutritionStatusId, `Failed to get nutrition info: ${error.message}`, 'error');
    }
};

function displayNutritionInfo(mealName, nutritionData, nutritionResultsId = 'nutritionResults') {
    const resultsDiv = document.getElementById(nutritionResultsId);
    
    const nutritionTable = `
        <div class="meal-card">
            <h3>Nutritional Information - ${mealName}</h3>
            <table class="nutrition-table">
                <thead>
                    <tr>
                        <th>Menu Item</th>
                        <th>Main Course</th>
                        <th>Calories (kcal)</th>
                        <th>Carbs (g)</th>
                        <th>Sugar (g)</th>
                        <th>Fiber (g)</th>
                        <th>Fat (g)</th>
                        <th>Protein (g)</th>
                    </tr>
                </thead>
                <tbody>
                    ${nutritionData.map(item => `
                        <tr>
                            <td>${item.name}</td>
                            <td>${item.isMain ? 'Yes' : 'No'}</td>
                            <td>${item.calorie}</td>
                            <td>${item.carbohydrate}</td>
                            <td>${item.sugar}</td>
                            <td>${item.fiber}</td>
                            <td>${item.fat}</td>
                            <td>${item.protein}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: bold; background: #f0f0f0;">
                        <td>TOTAL</td>
                        <td>-</td>
                        <td>${nutritionData.reduce((sum, item) => sum + item.calorie, 0)}</td>
                        <td>${nutritionData.reduce((sum, item) => sum + item.carbohydrate, 0)}</td>
                        <td>${nutritionData.reduce((sum, item) => sum + item.sugar, 0)}</td>
                        <td>${nutritionData.reduce((sum, item) => sum + item.fiber, 0)}</td>
                        <td>${nutritionData.reduce((sum, item) => sum + item.fat, 0)}</td>
                        <td>${nutritionData.reduce((sum, item) => sum + item.protein, 0)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
    
    resultsDiv.innerHTML = nutritionTable;
}

// Cache management functions
window.getCacheStatus = async function() {
    try {
        showLoading('cacheStatus', 'Getting cache status');
        
        const response = await fetch('/api/cache/status');
        const result = await response.json();
        
        if (result.success) {
            displayCacheStatus(result);
        } else {
            showStatus('cacheStatus', `Failed to get cache status: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Cache status error:', error);
        showStatus('cacheStatus', `Failed to get cache status: ${error.message}`, 'error');
    }
};

window.clearCache = async function() {
    try {
        if (!confirm('Are you sure you want to clear all cache files?')) {
            return;
        }
        
        showLoading('cacheStatus', 'Clearing cache');
        
        const response = await fetch('/api/cache/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('cacheStatus', result.message, 'success');
            // Refresh cache status
            setTimeout(getCacheStatus, 1000);
        } else {
            showStatus('cacheStatus', `Failed to clear cache: ${result.error}`, 'error');
        }
        
    } catch (error) {
        console.error('Cache clear error:', error);
        showStatus('cacheStatus', `Failed to clear cache: ${error.message}`, 'error');
    }
};

function displayCacheStatus(data) {
    const resultsDiv = document.getElementById('cacheStatus');
    
    if (data.totalFiles === 0) {
        resultsDiv.innerHTML = '<p>No cache files found.</p>';
        return;
    }
    
    const statusHTML = `
        <h3>📁 Cache Status</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px;">
            <div class="status info">
                <strong>Total Files:</strong> ${data.totalFiles}
            </div>
            <div class="status success">
                <strong>Valid:</strong> ${data.validFiles}
            </div>
            <div class="status error">
                <strong>Expired:</strong> ${data.expiredFiles}
            </div>
            <div class="status info">
                <strong>Total Size:</strong> ${(data.totalSize / 1024).toFixed(1)} KB
            </div>
        </div>
        
        ${data.files.length > 0 ? `
        <table class="meals-table">
            <thead>
                <tr>
                    <th>File</th>
                    <th>Size (KB)</th>
                    <th>Created</th>
                    <th>Age (min)</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${data.files.map(file => `
                    <tr>
                        <td style="font-family: monospace; font-size: 11px;">${file.file}</td>
                        <td>${(file.size / 1024).toFixed(1)}</td>
                        <td>${new Date(file.created).toLocaleString()}</td>
                        <td>${Math.floor(file.age / 60)}</td>
                        <td>
                            <span class="restaurant-badge" style="background: ${file.isValid ? '#4CAF50' : '#f44336'}">
                                ${file.isValid ? 'Valid' : 'Expired'}
                            </span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ` : ''}
    `;
    
    resultsDiv.innerHTML = statusHTML;
}

// Tab switching functionality
window.switchTab = function(tabName, clickedElement = null) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabName + '-tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked button (if provided, otherwise find it)
    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        // Find the button for this tab and activate it
        const targetButton = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
    }
    
    // Auto-fetch meals when switching to meal tabs
    if (tabName === 'takein') {
        if (selectedRestaurants.length === 0) {
            showStatus('takeinMealsStatus', 'Please select restaurants first in the Restaurant Selection tab', 'info');
        } else {
            // Automatically fetch meals if we have restaurants selected and required fields
            const mealDate = document.getElementById('takeinMealDate').value;
            const mealTimeId = document.getElementById('takeinMealTimeId').value;
            
            if (mealDate && mealTimeId) {
                console.log('🍴 Auto-fetching Take In meals for selected restaurants...');
                getTakeinMeals();
            } else if (!mealDate) {
                showStatus('takeinMealsStatus', 'Please enter a date to view meals', 'info');
            } else if (!mealTimeId) {
                showStatus('takeinMealsStatus', 'Please select a meal time to view meals', 'info');
            }
        }
    } else if (tabName === 'takeout') {
        if (selectedRestaurants.length === 0) {
            showStatus('takeoutMealsStatus', 'Please select restaurants first in the Restaurant Selection tab', 'info');
        } else {
            // Automatically fetch meals if we have restaurants selected and required fields
            const mealDate = document.getElementById('takeoutMealDate').value;
            const mealTimeId = document.getElementById('takeoutMealTimeId').value;
            
            if (mealDate && mealTimeId) {
                console.log('📦 Auto-fetching Take Out meals for selected restaurants...');
                getTakeoutMeals();
            } else if (!mealDate) {
                showStatus('takeoutMealsStatus', 'Please enter a date to view meals', 'info');
            } else if (!mealTimeId) {
                showStatus('takeoutMealsStatus', 'Please select a meal time to view meals', 'info');
            }
        }
    }
}

// Handle Take In meal date change
window.onTakeinMealDateChange = function() {
    const mealDate = document.getElementById('takeinMealDate').value;
    const mealTimeId = document.getElementById('takeinMealTimeId').value;
    
    // Only auto-fetch if we're on the takein tab, have selected restaurants, date, and meal time
    const takeinTab = document.getElementById('takein-tab');
    const isTakeinTabActive = takeinTab && takeinTab.classList.contains('active');
    
    if (isTakeinTabActive && selectedRestaurants.length > 0 && mealDate && mealTimeId) {
        console.log('🍴 Auto-fetching Take In meals due to date change...');
        getTakeinMeals();
    }
}

// Handle Take In meal time selection change
window.onTakeinMealTimeChange = function() {
    const mealDate = document.getElementById('takeinMealDate').value;
    const mealTimeId = document.getElementById('takeinMealTimeId').value;
    
    // Only auto-fetch if we're on the takein tab, have selected restaurants, date, and meal time
    const takeinTab = document.getElementById('takein-tab');
    const isTakeinTabActive = takeinTab && takeinTab.classList.contains('active');
    
    if (isTakeinTabActive && selectedRestaurants.length > 0 && mealDate && mealTimeId) {
        console.log('🍴 Auto-fetching Take In meals due to meal time change...');
        getTakeinMeals();
    }
}

// Handle Take Out meal date change
window.onTakeoutMealDateChange = function() {
    const mealDate = document.getElementById('takeoutMealDate').value;
    const mealTimeId = document.getElementById('takeoutMealTimeId').value;
    
    // Only auto-fetch if we're on the takeout tab, have selected restaurants, date, and meal time
    const takeoutTab = document.getElementById('takeout-tab');
    const isTakeoutTabActive = takeoutTab && takeoutTab.classList.contains('active');
    
    if (isTakeoutTabActive && selectedRestaurants.length > 0 && mealDate && mealTimeId) {
        console.log('📦 Auto-fetching Take Out meals due to date change...');
        getTakeoutMeals();
    }
}

// Handle Take Out meal time selection change
window.onTakeoutMealTimeChange = function() {
    const mealDate = document.getElementById('takeoutMealDate').value;
    const mealTimeId = document.getElementById('takeoutMealTimeId').value;
    
    // Only auto-fetch if we're on the takeout tab, have selected restaurants, date, and meal time
    const takeoutTab = document.getElementById('takeout-tab');
    const isTakeoutTabActive = takeoutTab && takeoutTab.classList.contains('active');
    
    if (isTakeoutTabActive && selectedRestaurants.length > 0 && mealDate && mealTimeId) {
        console.log('📦 Auto-fetching Take Out meals due to meal time change...');
        getTakeoutMeals();
    }
}
