// Global state
let sessionId = 'default';
let restaurants = [];
let selectedRestaurants = []; // Array to store multiple selected restaurants
let selectedTakeoutRestaurant = null; // Single restaurant for take-out only
let mealTimes = [];
let allMealTimes = []; // Store all meal times from all selected restaurants
let takeoutMealTimes = []; // Store meal times from selected take-out restaurant

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
const TAKEOUT_STORAGE_KEY = 'welplan_selected_takeout_restaurant';

function saveSelectedRestaurants() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedRestaurants));
        console.log(`💾 선택된 식당 ${selectedRestaurants.length}개를 로컬스토리지에 저장함`);
    } catch (error) {
        console.warn('Failed to save restaurants to localStorage:', error);
    }
}

function loadSelectedRestaurants() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            selectedRestaurants = JSON.parse(saved);
            console.log(`📂 로컬스토리지에서 식당 ${selectedRestaurants.length}개 로드됨`);
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
        console.log('🗑️  로컬스토리지에서 선택된 식당 삭제됨');
    } catch (error) {
        console.warn('Failed to clear restaurants from localStorage:', error);
    }
}

// localStorage utilities for take-out restaurant selection
function saveTakeoutRestaurant() {
    try {
        localStorage.setItem(TAKEOUT_STORAGE_KEY, JSON.stringify(selectedTakeoutRestaurant));
        console.log(`💾 테이크 아웃 식당을 로컬스토리지에 저장: ${selectedTakeoutRestaurant?.name || '없음'}`);
    } catch (error) {
        console.warn('Failed to save take-out restaurant to localStorage:', error);
    }
}

function loadTakeoutRestaurant() {
    try {
        const saved = localStorage.getItem(TAKEOUT_STORAGE_KEY);
        if (saved && saved !== 'null') {
            selectedTakeoutRestaurant = JSON.parse(saved);
            console.log(`📂 로컬스토리지에서 테이크 아웃 식당 로드: ${selectedTakeoutRestaurant?.name || '없음'}`);
            return selectedTakeoutRestaurant;
        }
    } catch (error) {
        console.warn('Failed to load take-out restaurant from localStorage:', error);
    }
    selectedTakeoutRestaurant = null;
    return null;
}

function clearStoredTakeoutRestaurant() {
    try {
        localStorage.removeItem(TAKEOUT_STORAGE_KEY);
        console.log('🗑️  로컬스토리지에서 테이크 아웃 식당 삭제됨');
    } catch (error) {
        console.warn('Failed to clear take-out restaurant from localStorage:', error);
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

    console.log('웰스토리 API 프론트엔드 초기화됨');
    
    // Load saved restaurant selections
    loadSelectedRestaurants();
    loadTakeoutRestaurant();
    
});



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
function displayUserInfo() {
    if (!userInfo) return;

    const userInfoSection = document.getElementById('userInfoSection');
    const userInfoDiv = document.getElementById('userInfo');
    
    userInfoSection.classList.remove('hidden')
}

// Restaurant search functionality
window.searchRestaurants = async function() {
    const searchQuery = document.getElementById('restaurantSearch').value;

    if (!searchQuery) {
        showStatus('searchStatus', '검색할 식당명을 입력하세요', 'error');
        return;
    }

    try {
        showLoading('searchStatus', 'Searching restaurants');
        
        const result = await apiCall('/restaurants/search', {
            searchQuery: searchQuery
        });

        restaurants = result.restaurants;
        
        if (restaurants.length === 0) {
            showStatus('searchStatus', '식당을 찾을 수 없습니다', 'info');
            document.getElementById('restaurantResults').innerHTML = '';
            return;
        }

        showStatus('searchStatus', `식당 ${restaurants.length}개를 찾았습니다`, 'success');
        displayRestaurants();
        
    } catch (error) {
        console.error('식당 검색 오류:', error);
        showStatus('searchStatus', `검색 실패: ${error.message}`, 'error');
    }
};

function displayRestaurants() {
    const resultsDiv = document.getElementById('restaurantResults');
    
    const restaurantCards = restaurants.map((restaurant, index) => {
        const isSelected = selectedRestaurants.some(r => r.id === restaurant.id);
        return `
        <label for="restaurant-${index}" class="restaurant-card">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <input type="checkbox" id="restaurant-${index}" ${isSelected ? 'checked' : ''} 
                       onchange="toggleRestaurantSelection(${index})" style="margin-right: 10px; transform: scale(1.2);">
                <h3 style="margin: 0;">${restaurant.name}</h3>
            </div>
            <p>${restaurant.description.split('|').join(' > ')}</p>
        </label>
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
        showStatus('searchStatus', `${restaurant.name}을 선택에서 제거함`, 'info');
    } else {
        // Add to selection
        selectedRestaurants.push(restaurant);
        showStatus('searchStatus', `${restaurant.name}을 선택에 추가함`, 'success');
        wasAdded = true;
    }
    
    // Save to localStorage
    saveSelectedRestaurants();
    
    updateSelectedRestaurantsList();
    updateTakeoutRestaurantDropdown();
    
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
            <p>${restaurant.description.split('|').join(' > ')}</p>
            <button class="btn" onclick="removeFromSelection('${restaurant.id}')">제거</button>
        </div>
    `).join('');
    
    listDiv.innerHTML = restaurantCards;
    
    showStatus('selectedRestaurantsStatus', `식당 ${selectedRestaurants.length}개 선택됨`, 'success');
}

// Update select dropdowns for meal operations
// Restaurant select dropdowns are no longer needed since meal times are auto-fetched

// Remove restaurant from selection
window.removeFromSelection = async function(restaurantId) {
    const index = selectedRestaurants.findIndex(r => r.id === restaurantId);
    if (index >= 0) {
        const restaurant = selectedRestaurants[index];
        selectedRestaurants.splice(index, 1);
        showStatus('selectedRestaurantsStatus', `${restaurant.name}을 선택에서 제거함`, 'info');
        
        // Save to localStorage
        saveSelectedRestaurants();
        
        // Update displays
        updateSelectedRestaurantsList();
        updateRestaurantSelects();
        updateTakeoutRestaurantDropdown();
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
    updateTakeoutRestaurantDropdown();
    displayRestaurants(); // Refresh to update checkboxes
    showStatus('selectedRestaurantsStatus', '모든 선택이 취소되었습니다', 'info');
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
        showStatus('searchStatus', `${restaurant.name} 등록 성공`, 'success');
    } catch (error) {
        console.error('Registration error:', error);
        showStatus('searchStatus', `등록 실패: ${error.message}`, 'error');
    }
};

window.unregisterRestaurant = async function(index) {
    const restaurant = restaurants[index];
    
    try {
        showLoading('searchStatus', 'Unregistering restaurant');
        await apiCall('/restaurants/unregister', {
            restaurantData: restaurant
        });
        showStatus('searchStatus', `${restaurant.name} 등록 취소 성공`, 'success');
    } catch (error) {
        console.error('Unregistration error:', error);
        showStatus('searchStatus', `등록 취소 실패: ${error.message}`, 'error');
    }
};

window.checkRegistration = async function(index) {
    const restaurant = restaurants[index];
    
    try {
        showLoading('searchStatus', 'Checking registration');
        const result = await apiCall('/restaurants/check-registration', {
            restaurantId: restaurant.id
        });
        const status = result.isRegistered ? '등록됨' : '등록되지 않음';
        showStatus('searchStatus', `${restaurant.name}은 ${status}`, 'info');
    } catch (error) {
        console.error('Registration check error:', error);
        showStatus('searchStatus', `등록 확인 실패: ${error.message}`, 'error');
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
    
    // Only update if we have meal times or if selects are empty
    if (allMealTimes.length > 0 || (takeinSelect && takeinSelect.children.length <= 1)) {
        const optionsHTML = '<option value="">식사 시간 선택</option>' + 
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
    }
}

// Update take-out restaurant dropdown
function updateTakeoutRestaurantDropdown() {
    const takeoutSelect = document.getElementById('takeoutRestaurantSelect');
    if (!takeoutSelect) return;
    
    const currentValue = takeoutSelect.value;
    const optionsHTML = '<option value="">테이크 아웃 식당을 선택하세요</option>' + 
        selectedRestaurants.map((restaurant, index) => 
            `<option value="${index}">${restaurant.name}</option>`
        ).join('');
    
    takeoutSelect.innerHTML = optionsHTML;
    
    // If we had a previously selected restaurant and it's still in the list, restore selection
    if (selectedTakeoutRestaurant && currentValue) {
        const matchingIndex = selectedRestaurants.findIndex(r => r.id === selectedTakeoutRestaurant.id);
        if (matchingIndex >= 0) {
            takeoutSelect.value = matchingIndex;
        } else {
            // Previously selected restaurant is no longer available
            selectedTakeoutRestaurant = null;
            saveTakeoutRestaurant();
            updateTakeoutRestaurantDisplay();
        }
    }
}

// Update take-out meal time dropdown (separate from regular meal times)
function updateTakeoutMealTimeSelect() {
    const takeoutMealTimeSelect = document.getElementById('takeoutMealTimeId');
    if (!takeoutMealTimeSelect) return;
    
    if (takeoutMealTimes.length > 0) {
        const optionsHTML = '<option value="">Select meal time</option>' + 
            takeoutMealTimes.map(mealTime => 
                `<option value="${mealTime.id}">${mealTime.name}</option>`
            ).join('');
        
        const currentValue = takeoutMealTimeSelect.value;
        takeoutMealTimeSelect.innerHTML = optionsHTML;
        if (currentValue && takeoutMealTimes.some(mt => mt.id === currentValue)) {
            takeoutMealTimeSelect.value = currentValue;
        }
    } else {
        takeoutMealTimeSelect.innerHTML = '<option value="">Select meal time</option>';
    }
}

// Take-out restaurant selection event handlers
window.onTakeoutRestaurantChange = async function() {
    const selectElement = document.getElementById('takeoutRestaurantSelect');
    const selectedIndex = selectElement.value;
    
    if (!selectedIndex) {
        selectedTakeoutRestaurant = null;
        takeoutMealTimes = [];
        saveTakeoutRestaurant();
        updateTakeoutRestaurantDisplay();
        updateTakeoutMealTimeSelect();
        return;
    }
    
    const restaurant = selectedRestaurants[parseInt(selectedIndex)];
    selectedTakeoutRestaurant = restaurant;
    saveTakeoutRestaurant();
    
    updateTakeoutRestaurantDisplay();
    
    // Fetch meal times for the selected take-out restaurant
    await fetchTakeoutMealTimes();
    getTakeoutMeals()
};

window.clearTakeoutRestaurant = function() {
    selectedTakeoutRestaurant = null;
    takeoutMealTimes = [];
    saveTakeoutRestaurant();
    
    const selectElement = document.getElementById('takeoutRestaurantSelect');
    if (selectElement) {
        selectElement.value = '';
    }
    
    updateTakeoutRestaurantDisplay();
    updateTakeoutMealTimeSelect();
    showStatus('takeoutRestaurantStatus', 'Take-out restaurant selection cleared', 'info');
    
    // Clear any displayed take-out meals
    const resultsDiv = document.getElementById('takeoutMealsResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
    }
    showStatus('takeoutMealsStatus', '', '');
};

// Display selected take-out restaurant
function updateTakeoutRestaurantDisplay() {
    const displayDiv = document.getElementById('takeoutSelectedRestaurant');
    if (!displayDiv) return;
    
    if (!selectedTakeoutRestaurant) {
        displayDiv.innerHTML = '<p>테이크 아웃 식당이 선택되지 않았습니다. 위에서 사용 가능한 식당을 선택하세요.</p>';
        return;
    }
    
    displayDiv.innerHTML = `
        <div class="restaurant-card">
            <h3>📦 Selected for Take-Out: ${selectedTakeoutRestaurant.name}</h3>
            <p><strong>ID:</strong> ${selectedTakeoutRestaurant.id}</p>
            <p><strong>Description:</strong> ${selectedTakeoutRestaurant.description}</p>
        </div>
    `;
}

// Fetch meal times for the selected take-out restaurant
async function fetchTakeoutMealTimes() {
    if (!selectedTakeoutRestaurant) {
        takeoutMealTimes = [];
        updateTakeoutMealTimeSelect();
        return;
    }
    
    try {
        console.log(`🔄 Fetching meal times for take-out restaurant: ${selectedTakeoutRestaurant.name}`);
        
        const result = await apiCall('/restaurants/meal-times', {
            restaurantData: selectedTakeoutRestaurant
        });
        
        if (result.success && result.mealTimes && result.mealTimes.length > 0) {
            takeoutMealTimes = result.mealTimes;
            updateTakeoutMealTimeSelect();
            
            // Set default meal time
            const defaultMealTime = getDefaultMealTime(takeoutMealTimes);
            if (defaultMealTime) {
                const takeoutMealTimeSelect = document.getElementById('takeoutMealTimeId');
                if (takeoutMealTimeSelect) {
                    takeoutMealTimeSelect.value = defaultMealTime.id;
                }
            }
            
            console.log(`✅ Fetched ${result.mealTimes.length} meal times for take-out restaurant`);
        } else {
            takeoutMealTimes = [];
            updateTakeoutMealTimeSelect();
            console.warn(`⚠️  No meal times returned from take-out restaurant ${selectedTakeoutRestaurant.name}`);
        }
        
    } catch (error) {
        console.error(`❌ Failed to get meal times for take-out restaurant ${selectedTakeoutRestaurant.name}:`, error.message);
        takeoutMealTimes = [];
        updateTakeoutMealTimeSelect();
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
            // Take In: exclude meals with "T/O" prefix in course name, BUT include meals with "도시락" in name
            filteredMeals = allMeals.filter(meal => {
                // If meal name contains "도시락", it's always Take In
                if (meal.name && meal.name.includes('도시락')) {
                    return true;
                }
                // Otherwise, exclude T/O meals
                return !meal.menuCourseName || !meal.menuCourseName.startsWith('T/O');
            });
        } else if (mealType === 'takeout') {
            // Take Out: only include meals with "T/O" prefix in course name, BUT exclude meals with "도시락" in name
            filteredMeals = allMeals.filter(meal => {
                // If meal name contains "도시락", it's never Take Out (always Take In)
                if (meal.name && meal.name.includes('도시락')) {
                    return false;
                }
                // Otherwise, only include T/O meals
                return meal.menuCourseName && meal.menuCourseName.startsWith('T/O');
            });
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
    
    // Convert date from YYYY-MM-DD to YYYYMMDD format if needed
    const formattedDate = dateStr.includes('-') ? dateStr.replace(/-/g, '') : dateStr;
    
    await fetchMeals(formattedDate, mealTimeId, 'takein', 'takeinMealsStatus', 'takeinMealsResults');
};

// Take Out Meals functionality  
window.getTakeoutMeals = async function() {
    const dateStr = document.getElementById('takeoutMealDate').value;
    const mealTimeId = document.getElementById('takeoutMealTimeId').value;
    
    // Convert date from YYYY-MM-DD to YYYYMMDD format if needed
    const formattedDate = dateStr.includes('-') ? dateStr.replace(/-/g, '') : dateStr;
    
    if (!formattedDate || !/^\d{8}$/.test(formattedDate)) {
        showStatus('takeoutMealsStatus', 'YYYYMMDD 형식의 유효한 날짜를 입력하세요', 'error');
        return;
    }
    
    if (!mealTimeId) {
        showStatus('takeoutMealsStatus', '식사 시간을 선택하세요', 'error');
        return;
    }

    if (!selectedTakeoutRestaurant) {
        showStatus('takeoutMealsStatus', '먼저 테이크 아웃 식당을 선택하세요', 'error');
        return;
    }

    try {
        showLoading('takeoutMealsStatus', 'Getting Take Out meals');
        
        const result = await apiCall('/restaurants/meals', {
            restaurantData: selectedTakeoutRestaurant,
            date: formattedDate,
            mealTimeId: mealTimeId
        });
        
        // Add restaurant info to each meal for identification
        const mealsWithRestaurant = result.meals.map(meal => ({
            ...meal,
            restaurantName: selectedTakeoutRestaurant.name
        }));
        
        // Filter meals for take-out: only include meals with "T/O" prefix in course name, BUT exclude meals with "도시락" in name
        const filteredMeals = mealsWithRestaurant.filter(meal => {
            // If meal name contains "도시락", it's never Take Out (always Take In)
            if (meal.name && meal.name.includes('도시락')) {
                return false;
            }
            // Otherwise, only include T/O meals
            return meal.menuCourseName && meal.menuCourseName.startsWith('T/O');
        });
        
        if (filteredMeals.length === 0) {
            showStatus('takeoutMealsStatus', `선택된 조건에 맞는 테이크 아웃 메뉴를 찾을 수 없습니다`, 'info');
            document.getElementById('takeoutMealsResults').innerHTML = '<p>테이크 아웃 메뉴를 찾을 수 없습니다.</p>';
            return;
        }
        
        showStatus('takeoutMealsStatus', `${selectedTakeoutRestaurant.name}에서 테이크 아웃 메뉴 ${filteredMeals.length}개를 찾았습니다`, 'success');
        displayMeals(filteredMeals, 'takeoutMealsResults');
        
    } catch (error) {
        console.error('Take-out meals error:', error);
        showStatus('takeoutMealsStatus', `테이크 아웃 메뉴 가져오기 실패: ${error.message}`, 'error');
    }
};

// Fetch menu items for multiple meals
async function fetchMenuItemsForMeals(meals) {
    console.log(`🍽️  Fetching menu items for ${meals.length} meals`);
    
    const mealsWithMenuItems = [];
    
    for (const meal of meals) {
        try {
            const result = await apiCall('/meals/menu-items', {
                mealData: meal
            });
            
            if (result.success && result.menuItems && result.menuItems.length > 0) {
                mealsWithMenuItems.push({
                    ...meal,
                    menuItems: result.menuItems
                });
                console.log(`✅ Fetched ${result.menuItems.length} menu items for ${meal.name}${result.cached ? ' (cached)' : ''}`);
            } else {
                console.warn(`⚠️  No menu items for ${meal.name}`);
                mealsWithMenuItems.push({
                    ...meal,
                    menuItems: []
                });
            }
        } catch (error) {
            console.error(`❌ Failed to get menu items for ${meal.name}:`, error.message);
            mealsWithMenuItems.push({
                ...meal,
                menuItems: []
            });
        }
    }
    
    return mealsWithMenuItems;
}

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
    // Check if this is Take Out meals and should show menu items
    const isTakeOutMeals = resultsElementId === 'takeoutMealsResults';
    
    // Prepare meals data based on the meal type
    let processedMeals = meals;
    
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
        processedMeals = await fetchNutritionForMeals(meals);
    } else if (isTakeOutMeals) {
        console.log('📦 Fetching menu items for Take Out meals...');
        // Show enhanced loading message
        resultsDiv.innerHTML = `
            <div class="menu-items-loading">
                <div class="loading">⚡ Loading ${meals.length} meals with detailed menu items...</div>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                    Fetching all individual menu items for each meal. This may take a moment.
                </p>
            </div>
        `;
        processedMeals = await fetchMenuItemsForMeals(meals);
    }
    
    let tableHTML = '';
    
    if (isTakeOutMeals) {
        // Take-out meals: Show individual menu items in table format with nutrition
        const allMenuItems = [];
        let menuItemIndex = 0;
        
        processedMeals.forEach((meal, mealIndex) => {
            if (meal.menuItems && meal.menuItems.length > 0) {
                meal.menuItems.forEach(item => {
                    // Filter out main menu items (items with isMain = true)
                    if (!item.isMain) {
                        allMenuItems.push({
                            ...item,
                            mealName: meal.name,
                            restaurantName: meal.restaurantName,
                            menuCourseName: meal.menuCourseName,
                            menuCourseType: meal.menuCourseType,
                            setName: meal.setName,
                            hallNo: meal.hallNo,
                            photoUrl: meal.photoUrl,
                            originalMealIndex: mealIndex,
                            menuItemIndex: menuItemIndex++
                        });
                    }
                });
            }
        });

        tableHTML = `
            <table class="meals-table">
                <thead>
                    <tr>
                        <th>Restaurant</th>
                        <th>Meal</th>
                        <th>Menu Item</th>
                        <th class="nutrition-header calories">칼로리</th>
                        <th class="nutrition-header carbs">탄수화물</th>
                        <th class="nutrition-header sugar">당</th>
                        <th class="nutrition-header fat">지방</th>
                        <th class="nutrition-header protein">단백질</th>
                    </tr>
                </thead>
                <tbody>
                    ${allMenuItems.map((item, index) => `
                        <tr>
                            <td>
                                <span class="restaurant-badge">
                                    📍 ${item.restaurantName || 'Unknown'}
                                </span>
                            </td>
                            <td>
                                <strong>${item.mealName}</strong>
                            </td>
                            <td>
                                <strong>[${item.setName || '-'}] ${item.name}</strong>
                            </td>
                            <td class="nutrition-col nutrition-calories">${Math.floor((item.calorie || 0)*100)/100} kcal</td>
                            <td class="nutrition-col nutrition-carbs">${Math.floor((item.carbohydrate || 0)*100)/100}g</td>
                            <td class="nutrition-col nutrition-sugar">${Math.floor((item.sugar || 0)*100)/100}g</td>
                            <td class="nutrition-col nutrition-fat">${Math.floor((item.fat || 0)*100)/100}g</td>
                            <td class="nutrition-col nutrition-protein">${Math.floor((item.protein || 0)*100)/100}g</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${allMenuItems.length === 0 ? '<p>No menu items found for the selected take-out meals.</p>' : ''}
        `;
    } else {
        // Take-in meals or default: Show table view with nutrition
        const nutritionColumns = isTakeInMeals ? `
            <th class="nutrition-header calories">칼로리</th>
            <th class="nutrition-header carbs">탄수화물</th>
            <th class="nutrition-header sugar">당</th>
            <th class="nutrition-header fat">지방</th>
            <th class="nutrition-header protein">단백질</th>
        ` : '';
        
        tableHTML = `
            <table class="meals-table">
                <thead>
                    <tr>
                        <th>Restaurant</th>
                        <th>Image</th>
                        <th>Meal Name</th>
                        ${nutritionColumns}
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${processedMeals.map((meal, index) => {
                        let nutritionCells = '';
                        if (isTakeInMeals && meal.nutritionTotals) {
                            // Check filtering options for Take In meals
                            const isTakeinResults = resultsElementId === 'takeinMealsResults';
                            const filterMainOnly = isTakeinResults && document.getElementById('takeinFilterMainOnly')?.checked;
                            const filterExcludeOptional = isTakeinResults && document.getElementById('takeinFilterExcludeOptional')?.checked;
                            
                            let nutritionTotals = meal.nutritionTotals;
                            if ((filterMainOnly || filterExcludeOptional) && meal.nutritionData) {
                                // Apply filters to nutrition items
                                let filteredItems = meal.nutritionData;
                                
                                if (filterMainOnly) {
                                    filteredItems = filteredItems.filter(item => item.isMain);
                                }
                                
                                if (filterExcludeOptional) {
                                    filteredItems = filteredItems.filter(item => 
                                        !item.name?.includes('추가찬') && !item.name?.includes('택1')
                                    );
                                }
                                
                                // Recalculate totals with filtered items
                                nutritionTotals = {
                                    calories: filteredItems.reduce((sum, item) => sum + (item.calorie || 0), 0),
                                    carbs: filteredItems.reduce((sum, item) => sum + (item.carbohydrate || 0), 0),
                                    sugar: filteredItems.reduce((sum, item) => sum + (item.sugar || 0), 0),
                                    fiber: filteredItems.reduce((sum, item) => sum + (item.fiber || 0), 0),
                                    fat: filteredItems.reduce((sum, item) => sum + (item.fat || 0), 0),
                                    protein: filteredItems.reduce((sum, item) => sum + (item.protein || 0), 0)
                                };
                            }
                            
                            nutritionCells = `
                                <td class="nutrition-col nutrition-calories">${Math.floor((nutritionTotals.calories || 0)*100)/100} kcal</td>
                                <td class="nutrition-col nutrition-carbs">${Math.floor((nutritionTotals.carbs || 0)*100)/100}g</td>
                                <td class="nutrition-col nutrition-sugar">${Math.floor((nutritionTotals.sugar || 0)*100)/100}g</td>
                                <td class="nutrition-col nutrition-fat">${Math.floor((nutritionTotals.fat || 0)*100)/100}g</td>
                                <td class="nutrition-col nutrition-protein">${Math.floor((nutritionTotals.protein || 0)*100)/100}g</td>
                            `;
                        } else if (isTakeInMeals) {
                            nutritionCells = `<td colspan="6" class="nutrition-loading">Nutrition data unavailable</td>`;
                        }
                        
                        return `
                        <tr>
                            <td>
                                <span class="restaurant-badge">
                                    📍 ${meal.restaurantName || 'Unknown'}
                                </span>
                            </td>
                            <td class="meal-image-cell">
                                ${meal.photoUrl ? `<img class="meal-image-thumb" src="${meal.photoUrl}" alt="${meal.name}" onerror="this.style.display='none'" onclick="showImageModal('${meal.photoUrl}', '${meal.name}')">` : '-'}
                            </td>
                            <td>
                                [${meal.menuCourseName}] <strong>${meal.name}</strong>
                                ${meal.subMenuTxt ? `<br><small class="meal-description">${meal.subMenuTxt}</small>` : ''}
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
    }
    
    resultsDiv.innerHTML = tableHTML;
    
    // Make the table sortable
    setTimeout(() => {
        const table = resultsDiv.querySelector('.meals-table');
        if (table) {
            makeTableSortable(table, resultsElementId);
        }
    }, 100);
    
    // Store meals globally for nutrition access
    window.currentMeals = processedMeals;
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

// Nutrition modal function
window.showNutritionModal = function(mealName, nutritionData, errorMessage = null) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    
    // Check filtering options for Take In meals
    const filterMainOnly = document.getElementById('takeinFilterMainOnly')?.checked;
    const filterExcludeOptional = document.getElementById('takeinFilterExcludeOptional')?.checked;
    let filteredData = nutritionData;
    
    if ((filterMainOnly || filterExcludeOptional) && nutritionData && Array.isArray(nutritionData)) {
        if (filterMainOnly) {
            filteredData = filteredData.filter(item => item.isMain);
        }
        
        if (filterExcludeOptional) {
            filteredData = filteredData.filter(item => 
                !item.name?.includes('추가찬') && !item.name?.includes('택1')
            );
        }
        
        const filterTypes = [];
        if (filterMainOnly) filterTypes.push('main courses only');
        if (filterExcludeOptional) filterTypes.push('excluding optional items');
        console.log(`🎯 Filtering nutrition modal: ${filteredData.length}/${nutritionData.length} items (${filterTypes.join(', ')})`);
    }
    
    let content = '';
    if (errorMessage) {
        content = `<p style="color: #ef4444; text-align: center; padding: 20px;">Error: ${errorMessage}</p>`;
    } else if (filteredData.length === 0) {
        let emptyMessage = 'No nutritional information available';
        if (filterMainOnly || filterExcludeOptional) {
            const filterTypes = [];
            if (filterMainOnly) filterTypes.push('main courses');
            if (filterExcludeOptional) filterTypes.push('non-optional items');
            emptyMessage = `No items found after filtering (${filterTypes.join(' and ')})`;
        }
        content = `<p style="text-align: center; padding: 20px; color: #6b7280;">${emptyMessage}</p>`;
    } else {
        content = `
            <div style="max-height: 70vh; overflow-y: auto;">
                <table class="nutrition-table" style="width: 100%; font-size: 14px;">
                    <thead>
                        <tr>
                            <th>Menu Item</th>
                            <th>Main Course</th>
                            <th class="nutrition-header calories">Calories</th>
                            <th class="nutrition-header carbs">Carbs (g)</th>
                            <th class="nutrition-header sugar">Sugar (g)</th>
                            <th class="nutrition-header fiber">Fiber (g)</th>
                            <th class="nutrition-header fat">Fat (g)</th>
                            <th class="nutrition-header protein">Protein (g)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(item => `
                            <tr>
                                <td style="font-weight: 500;">${item.name}</td>
                                <td>${item.isMain ? '<span class="main-course-badge">Yes</span>' : 'No'}</td>
                                <td class="nutrition-calories" style="text-align: center; font-weight: bold;">${(item.calorie || 0).toFixed(2)}</td>
                                <td class="nutrition-carbs" style="text-align: center; font-weight: bold;">${(item.carbohydrate || 0).toFixed(2)}</td>
                                <td class="nutrition-sugar" style="text-align: center; font-weight: bold;">${(item.sugar || 0).toFixed(2)}</td>
                                <td class="nutrition-fiber" style="text-align: center; font-weight: bold;">${(item.fiber || 0).toFixed(2)}</td>
                                <td class="nutrition-fat" style="text-align: center; font-weight: bold;">${(item.fat || 0).toFixed(2)}</td>
                                <td class="nutrition-protein" style="text-align: center; font-weight: bold;">${(item.protein || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold; background: #f9fafb; border-top: 2px solid #6b7280;">
                            <td style="font-weight: bold;">TOTAL</td>
                            <td>-</td>
                            <td class="nutrition-calories" style="text-align: center; font-weight: bold;">${filteredData.reduce((sum, item) => sum + (item.calorie || 0), 0).toFixed(2)}</td>
                            <td class="nutrition-carbs" style="text-align: center; font-weight: bold;">${filteredData.reduce((sum, item) => sum + (item.carbohydrate || 0), 0).toFixed(2)}</td>
                            <td class="nutrition-sugar" style="text-align: center; font-weight: bold;">${filteredData.reduce((sum, item) => sum + (item.sugar || 0), 0).toFixed(2)}</td>
                            <td class="nutrition-fiber" style="text-align: center; font-weight: bold;">${filteredData.reduce((sum, item) => sum + (item.fiber || 0), 0).toFixed(2)}</td>
                            <td class="nutrition-fat" style="text-align: center; font-weight: bold;">${filteredData.reduce((sum, item) => sum + (item.fat || 0), 0).toFixed(2)}</td>
                            <td class="nutrition-protein" style="text-align: center; font-weight: bold;">${filteredData.reduce((sum, item) => sum + (item.protein || 0), 0).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-height: 90%; min-width: 800px;">
            <span class="modal-close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h3 style="margin-bottom: 20px; text-align: center;">📊 Nutritional Information - ${mealName}</h3>
            ${content}
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
    
    // First, check if we already have processed nutrition data
    if (meal.nutritionData && meal.nutritionData.length > 0) {
        console.log('📊 Using existing nutrition data from backend');
        showNutritionModal(meal.name || meal.mealName || 'Unknown Meal', meal.nutritionData);
        return;
    }
    
    try {
        const result = await apiCall('/meals/nutrition', {
            mealData: meal
        });
        
        if (result.nutritionData.length === 0) {
            showNutritionModal(result.mealName, []);
            return;
        }

        // Backend already processed main course detection
        showNutritionModal(result.mealName, result.nutritionData);
        
    } catch (error) {
        console.error('Nutrition error:', error);
        showNutritionModal(meal.mealName || 'Unknown Meal', [], error.message);
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
    const tabButtons = document.querySelectorAll('.header-tab-btn');
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
        // Update take-out restaurant dropdown and display
        updateTakeoutRestaurantDropdown();
        updateTakeoutRestaurantDisplay();
        
        if (selectedRestaurants.length === 0) {
            showStatus('takeoutMealsStatus', 'Please select restaurants first in the Restaurant Selection tab', 'info');
        } else if (!selectedTakeoutRestaurant) {
            showStatus('takeoutMealsStatus', 'Please select a restaurant for take-out', 'info');
        } else {
            // Automatically fetch meals if we have take-out restaurant selected and required fields
            const mealDate = document.getElementById('takeoutMealDate').value;
            const mealTimeId = document.getElementById('takeoutMealTimeId').value;
            
            if (mealDate && mealTimeId) {
                console.log('📦 Auto-fetching Take Out meals for selected take-out restaurant...');
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
};

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

// Handle Take In filter change
window.onTakeinFilterChange = function() {
    // Re-display the current meals with the new filter
    if (window.currentMeals && window.currentMeals.length > 0) {
        displayMeals(window.currentMeals, 'takeinMealsResults');
    }
};

// Handle Take Out meal date change
window.onTakeoutMealDateChange = function() {
    const mealDate = document.getElementById('takeoutMealDate').value;
    const mealTimeId = document.getElementById('takeoutMealTimeId').value;
    
    // Only auto-fetch if we're on the takeout tab, have selected take-out restaurant, date, and meal time
    const takeoutTab = document.getElementById('takeout-tab');
    const isTakeoutTabActive = takeoutTab && takeoutTab.classList.contains('active');
    
    if (isTakeoutTabActive && selectedTakeoutRestaurant && mealDate && mealTimeId) {
        console.log('📦 Auto-fetching Take Out meals due to date change...');
        getTakeoutMeals();
    }
}

// Handle Take Out meal time selection change
window.onTakeoutMealTimeChange = function() {
    const mealDate = document.getElementById('takeoutMealDate').value;
    const mealTimeId = document.getElementById('takeoutMealTimeId').value;
    
    // Only auto-fetch if we're on the takeout tab, have selected take-out restaurant, date, and meal time
    const takeoutTab = document.getElementById('takeout-tab');
    const isTakeoutTabActive = takeoutTab && takeoutTab.classList.contains('active');
    
    if (isTakeoutTabActive && selectedTakeoutRestaurant && mealDate && mealTimeId) {
        console.log('📦 Auto-fetching Take Out meals due to meal time change...');
        getTakeoutMeals();
    }
}

// Table sorting functionality
function sortTable(tableId, columnIndex, dataType = 'string') {
    const table = document.getElementById(tableId) || document.querySelector(`#${tableId} table`) || document.querySelector('.meals-table');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const currentDirection = table.getAttribute('data-sort-direction') || 'asc';
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
    
    // Clear previous sort indicators
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        th.setAttribute('title', th.textContent + ' (click to sort)');
    });
    
    // Sort rows
    rows.sort((a, b) => {
        const aCell = a.cells[columnIndex];
        const bCell = b.cells[columnIndex];
        
        if (!aCell || !bCell) return 0;
        
        let aValue = aCell.textContent.trim();
        let bValue = bCell.textContent.trim();
        
        // Handle different data types
        if (dataType === 'number') {
            aValue = parseFloat(aValue) || 0;
            bValue = parseFloat(bValue) || 0;
        } else if (dataType === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        let comparison = 0;
        if (aValue > bValue) comparison = 1;
        else if (aValue < bValue) comparison = -1;
        
        return newDirection === 'desc' ? -comparison : comparison;
    });
    
    // Update DOM
    rows.forEach(row => tbody.appendChild(row));
    
    // Update sort indicators
    const targetHeader = table.querySelectorAll('th')[columnIndex];
    if (targetHeader) {
        targetHeader.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        targetHeader.setAttribute('title', `${targetHeader.textContent} (sorted ${newDirection})`);
    }
    
    table.setAttribute('data-sort-direction', newDirection);
}

// Make table headers sortable
function makeTableSortable(tableElement, tableId) {
    if (!tableElement) return;
    
    const headers = tableElement.querySelectorAll('thead th');
    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        header.setAttribute('title', header.textContent + ' (click to sort)');
        
        // Determine data type based on column content
        let dataType = 'string';
        if (header.classList.contains('nutrition-header') || 
            header.textContent.includes('Calories') || 
            header.textContent.includes('Carbs') || 
            header.textContent.includes('Sugar') || 
            header.textContent.includes('Fiber') || 
            header.textContent.includes('Fat') || 
            header.textContent.includes('Protein')) {
            dataType = 'number';
        }
        
        header.addEventListener('click', () => {
            sortTable(tableId, index, dataType);
        });
    });
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Load any saved restaurant selections
    loadSelectedRestaurants();
    loadTakeoutRestaurant();
    updateSelectedRestaurantsList();
    updateTakeoutRestaurantDropdown();
    updateTakeoutRestaurantDisplay();
    
    // Auto-authenticate and start session management
    autoAuthenticate().then(() => {
        startSessionAutoRefresh();
        startStatusUpdater();
    });
    
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('takeinMealDate').value = today;
    document.getElementById('takeoutMealDate').value = today;
});
