// Global state
let sessionId = 'default';
let restaurants = [];
let selectedRestaurants = []; // Array to store multiple selected restaurants
let selectedTakeoutRestaurant = null; // Single restaurant for take-out only
let mealTimes = [];
let allMealTimes = []; // Store all meal times from all selected restaurants
let takeoutMealTimes = []; // Store meal times from selected take-out restaurant
let selectedTakeoutItems = new Set(); // Store selected takeout menu item indices

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{"id":"REST000007","name":"R5 B1F","description":"모바일|모바일연구소|삼성전자|수원|r5|R5"},{"id":"REST000008","name":"R5 B2F","description":"모바일|모바일연구소|삼성전자|수원│r5│R5"},{"id":"REST000003","name":"R4 레인보우(B1F)","description":"디지털연구소|삼성전자|수원|r4"},{"id":"REST000005","name":"R4 오아시스(B1F)","description":"디지털연구소|삼성전자|수원|r4"},{"id":"REST000013","name":"R3 하모니(B1F)","description":"R3|삼성전자|수원|정보통신연구소|r3 공통 A0042119"}]))
    return [{"id":"REST000007","name":"R5 B1F","description":"모바일|모바일연구소|삼성전자|수원|r5|R5"},{"id":"REST000008","name":"R5 B2F","description":"모바일|모바일연구소|삼성전자|수원│r5│R5"},{"id":"REST000003","name":"R4 레인보우(B1F)","description":"디지털연구소|삼성전자|수원|r4"},{"id":"REST000005","name":"R4 오아시스(B1F)","description":"디지털연구소|삼성전자|수원|r4"},{"id":"REST000013","name":"R3 하모니(B1F)","description":"R3|삼성전자|수원|정보통신연구소|r3 공통 A0042119"}];
}

function clearStoredRestaurants() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log('🗑️  로컬스토리지에서 선택된 식당 삭제됨');
    } catch (error) {
        console.warn('Failed to clear restaurants from localStorage:', error);
    }
}

// P-Score settings management
const PSCORE_SETTINGS_KEY = 'welplan_pscore_settings';

// Default P-Score weights
const DEFAULT_PSCORE_WEIGHTS = {
    calorie: 0.1,
    carb: 0.8,
    sugar: 2.0,
    fat: 1.5,
    protein: 0.5
};

let pScoreWeights = { ...DEFAULT_PSCORE_WEIGHTS };

function savePScoreSettings() {
    try {
        localStorage.setItem(PSCORE_SETTINGS_KEY, JSON.stringify(pScoreWeights));
        console.log('💾 P-Score settings saved to localStorage');
    } catch (error) {
        console.warn('Failed to save P-Score settings to localStorage:', error);
    }
}

function loadPScoreSettings() {
    try {
        const saved = localStorage.getItem(PSCORE_SETTINGS_KEY);
        if (saved) {
            pScoreWeights = { ...DEFAULT_PSCORE_WEIGHTS, ...JSON.parse(saved) };
            console.log('📂 P-Score settings loaded from localStorage');
            return pScoreWeights;
        }
    } catch (error) {
        console.warn('Failed to load P-Score settings from localStorage:', error);
    }
    pScoreWeights = { ...DEFAULT_PSCORE_WEIGHTS };
    return pScoreWeights;
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
                       onchange="toggleRestaurantSelection(${index})" class="restaurant-checkbox">
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
    
    // Update URL hash
    updateURLHash();
    
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
        
        // Update URL hash
        updateURLHash();
        
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
        // warm up
        await apiCall('/restaurants/search', {
            searchQuery: 'R5'
        });
    } catch {}
    
    try {
        const uniqueMealTimes = new Map(); // Use Map to avoid duplicates
        let totalFetched = 0;
        let successCount = 0;
        let errorCount = 0;
        
        // Fetch meal times from all selected restaurants in parallel
        const promises = selectedRestaurants.map(async (restaurant) => {
            try {
                console.log(`⏳ Fetching meal times for ${restaurant.name}...`);
                
                // Ensure restaurant object has required fields
                if (!restaurant.id || !restaurant.name) {
                    console.warn(`⚠️  Invalid restaurant data for ${restaurant.name || 'unknown'}: missing id or name`);
                    return { success: false, error: 'Invalid restaurant data', restaurant };
                }
                
                const result = await apiCall('/restaurants/meal-times', {
                    restaurantData: restaurant
                });
                
                return { success: result.success, result, restaurant };
                
            } catch (error) {
                console.error(`❌ Failed to get meal times for ${restaurant.name}:`, error.message);
                return { success: false, error: error.message, restaurant };
            }
        });
        
        // Wait for all requests to complete
        const results = await Promise.all(promises);
        
        // Process results
        results.forEach(({ success, result, restaurant, error }) => {
            if (success && result.mealTimes && result.mealTimes.length > 0) {
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
                console.warn(`⚠️  No meal times returned from ${restaurant.name}${error ? ': ' + error : ''}`);
                errorCount++;
            }
        });
        
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
        
        // Also update gallery meal time select
        updateGalleryMealTimeSelect();
        
        // Check if gallery tab is active and can auto-load
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'gallery-tab') {
            setTimeout(() => {
                checkAndAutoLoadGallery();
            }, 50);
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
        // Update URL hash
        updateURLHash();
        return;
    }
    
    const restaurant = selectedRestaurants[parseInt(selectedIndex)];
    selectedTakeoutRestaurant = restaurant;
    saveTakeoutRestaurant();
    
    updateTakeoutRestaurantDisplay();
    
    // Update URL hash
    updateURLHash();
    
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
                return !meal.menuCourseName || !(meal.menuCourseName.startsWith('T/O') || meal.menuCourseName.includes('Take out') || meal.menuCourseName.includes('선택음료') || meal.name.includes('시차제'));
            });
        } else if (mealType === 'takeout') {
            // Take Out: only include meals with "T/O" prefix in course name, BUT exclude meals with "도시락" in name
            filteredMeals = allMeals.filter(meal => {
                // If meal name contains "도시락", it's never Take Out (always Take In)
                if (meal.name && meal.name.includes('도시락')) {
                    return false;
                }
                // Otherwise, only include T/O meals
                return meal.menuCourseName && (meal.menuCourseName.startsWith('T/O') || meal.menuCourseName.includes('Take out'));
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
            restaurantName: selectedTakeoutRestaurant.name,
            mealName: meal.mealName || meal.name // Ensure mealName is available for filtering
        }));
        
        // Check if drinks should be filtered out
        const filterDrinks = document.getElementById('takeoutFilterDrinks')?.checked;
        
        // Filter meals for take-out: only include meals with "T/O" prefix in course name, BUT exclude meals with "도시락" in name
        const filteredMeals = mealsWithRestaurant.filter(meal => {
            // If meal name contains "도시락", it's never Take Out (always Take In)
            if (meal.name && meal.name.includes('도시락')) {
                return false;
            }
            // Filter out drinks if checkbox is checked
            if (filterDrinks && (
                (meal.name && (meal.name.includes('음료') || meal.name.includes('드링킹') || meal.name.includes('음료 Zone'))) ||
                (meal.mealName && (meal.mealName.includes('음료') || meal.mealName.includes('드링킹') || meal.mealName.includes('음료 Zone'))) ||
                (meal.setName && (meal.setName.includes('음료') || meal.setName.includes('드링킹')))
            )) {
                return false;
            }
            // Otherwise, only include T/O meals
            return meal.menuCourseName && meal.menuCourseName.startsWith('T/O') || meal.menuCourseName.includes('Take out');
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
                    menuItems: result.menuItems,
                    mealName: result.mealName || meal.mealName || meal.name // Use the returned mealName from API
                });
                console.log(`✅ Fetched ${result.menuItems.length} menu items for ${meal.name}${result.cached ? ' (cached)' : ''}`);
            } else {
                console.warn(`⚠️  No menu items for ${meal.name}`);
                mealsWithMenuItems.push({
                    ...meal,
                    menuItems: [],
                    mealName: result.mealName || meal.mealName || meal.name
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
        
        // Check if drinks should be filtered out
        const filterDrinks = document.getElementById('takeoutFilterDrinks')?.checked;
        
        processedMeals.forEach((meal, mealIndex) => {
            // Skip entire meals that are drinks
            if (filterDrinks && meal.mealName && (
                meal.mealName.includes('음료') || 
                meal.mealName.includes('드링킹') || 
                meal.mealName.includes('음료 Zone')
            )) {
                return; // Skip this entire meal
            }
            
            if (meal.menuItems && meal.menuItems.length > 0) {
                meal.menuItems.forEach(item => {
                    // Filter out main menu items (items with isMain = true) first
                    if (item.isMain) {
                        return; // Skip main menu items
                    }
                    
                    // Filter out drinks if checkbox is checked (only for non-main items now)
                    if (filterDrinks && (
                        (item.name && (item.name.includes('음료') || item.name.includes('드링킹') || item.name.includes('음료 Zone'))) ||
                        (item.setName && (item.setName.includes('음료') || item.setName.includes('드링킹'))) ||
                        (item.mealName && (item.mealName.includes('음료 Zone') || item.mealName.includes('드링킹')))
                    )) {
                        return; // Skip this drink item
                    }
                    
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
                });
            }
        });

        // Store menu items globally for selection access
        window.currentTakeoutItems = allMenuItems;
        
        tableHTML = `
            <table class="meals-table">
                <thead>
                    <tr>
                        <th>선택</th>
                        <th>Restaurant</th>
                        <th>Meal</th>
                        <th>Menu Item</th>
                        <th class="nutrition-header pscore">P-Score</th>
                        <th class="nutrition-header calories">칼로리</th>
                        <th class="nutrition-header carbs">탄수화물</th>
                        <th class="nutrition-header sugar">당</th>
                        <th class="nutrition-header fat">지방</th>
                        <th class="nutrition-header protein">단백질</th>
                    </tr>
                </thead>
                <tbody>
                    ${allMenuItems.map((item, index) => {
                        // Calculate P-Score for individual menu item
                        const itemNutrition = {
                            calories: item.calorie || 0,
                            carbs: item.carbohydrate || 0,
                            sugar: item.sugar || 0,
                            fat: item.fat || 0,
                            protein: item.protein || 0
                        };
                        const pScore = calculatePScore(itemNutrition);
                        const pScoreColor = pScore <= 20 ? '#22c55e' : pScore <= 50 ? '#f59e0b' : '#ef4444';
                        const isSelected = selectedTakeoutItems.has(index);
                        
                        return `
                        <tr class="takeout-selectable-row ${isSelected ? 'selected-takeout-item' : ''}" onclick="toggleTakeoutItemSelection(${index})">
                            <td>
                                <input type="checkbox" 
                                       id="takeout-item-${index}" 
                                       ${isSelected ? 'checked' : ''}
                                       onclick="event.stopPropagation()">
                            </td>
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
                            <td class="nutrition-col nutrition-pscore" style="background-color: ${pScoreColor}20; color: ${pScoreColor}; font-weight: bold;">${pScore || 'N/A'}</td>
                            <td class="nutrition-col nutrition-calories">${Math.floor((item.calorie || 0)*100)/100} kcal</td>
                            <td class="nutrition-col nutrition-carbs">${Math.floor((item.carbohydrate || 0)*100)/100}g</td>
                            <td class="nutrition-col nutrition-sugar">${Math.floor((item.sugar || 0)*100)/100}g</td>
                            <td class="nutrition-col nutrition-fat">${Math.floor((item.fat || 0)*100)/100}g</td>
                            <td class="nutrition-col nutrition-protein">${Math.floor((item.protein || 0)*100)/100}g</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            ${allMenuItems.length === 0 ? '<p>No menu items found for the selected take-out meals.</p>' : ''}
        `;
    } else {
        // Take-in meals or default: Show table view with nutrition
        const nutritionColumns = isTakeInMeals ? `
            <th class="nutrition-header pscore">P-Score</th>
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
                            
                            // Calculate P-Score
                            const pScore = calculatePScore(nutritionTotals);
                            const pScoreColor = pScore <= 50 ? '#22c55e' : pScore <= 100 ? '#f59e0b' : '#ef4444';
                            
                            nutritionCells = `
                                <td class="nutrition-col nutrition-pscore" style="background-color: ${pScoreColor}20; color: ${pScoreColor}; font-weight: bold;">${pScore || 'N/A'}</td>
                                <td class="nutrition-col nutrition-calories">${Math.floor((nutritionTotals.calories || 0)*100)/100} kcal</td>
                                <td class="nutrition-col nutrition-carbs">${Math.floor((nutritionTotals.carbs || 0)*100)/100}g</td>
                                <td class="nutrition-col nutrition-sugar">${Math.floor((nutritionTotals.sugar || 0)*100)/100}g</td>
                                <td class="nutrition-col nutrition-fat">${Math.floor((nutritionTotals.fat || 0)*100)/100}g</td>
                                <td class="nutrition-col nutrition-protein">${Math.floor((nutritionTotals.protein || 0)*100)/100}g</td>
                            `;
                        } else if (isTakeInMeals) {
                            nutritionCells = `<td colspan="7" class="nutrition-loading">Nutrition data unavailable</td>`;
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
    
    // Apply mobile table view wrapper if scroll mode is selected
    const tabType = resultsElementId.includes('takein') ? 'takein' : 'takeout';
    const isScrollMode = document.querySelector(`input[name="${tabType}TableView"]:checked`)?.value === 'scroll';
    
    if (isScrollMode) {
        resultsDiv.innerHTML = `<div class="table-scroll-wrapper">${tableHTML}</div>`;
    } else {
        resultsDiv.innerHTML = tableHTML;
    }
    
    // Make the table sortable and add mobile controls
    setTimeout(() => {
        const table = resultsDiv.querySelector('.meals-table');
        if (table) {
            // Apply mobile scroll class if in scroll mode
            if (isScrollMode) {
                table.classList.add('horizontal-scroll');
            } else {
                table.classList.remove('horizontal-scroll');
            }
            makeTableSortable(table, resultsElementId);
            addMobileSortControls(table, resultsElementId, processedMeals);
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
    // Update URL hash
    updateURLHash();
    
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
    } else if (tabName === 'gallery') {
        // Gallery tab - ensure meal times are available
        if (selectedRestaurants.length === 0) {
            showStatus('galleryStatus', 'Please select restaurants first in the Restaurant Selection tab', 'info');
        } else if (allMealTimes.length === 0) {
            showStatus('galleryStatus', 'Loading meal times...', 'info');
        } else {
            const mealDate = document.getElementById('galleryDate').value;
            const mealTimeId = document.getElementById('galleryMealTimeId').value;
            
            if (mealDate && mealTimeId) {
                console.log('🖼️  Auto-loading gallery for selected date and time...');
                loadGallery();
            } else if (!mealDate) {
                showStatus('galleryStatus', 'Please select a date to view gallery', 'info');
            } else if (!mealTimeId) {
                showStatus('galleryStatus', 'Please select a meal time to view gallery', 'info');
            }
        }
    }
    
    // Update URL hash when tab changes
    setTimeout(() => updateURLHash(), 100);
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
    
    // Update URL hash
    updateURLHash();
};

// Handle Take In meal time selection change
window.onTakeinMealTimeChange = function() {
    const mealDate = document.getElementById('takeinMealDate').value;
    const mealTimeId = document.getElementById('takeinMealTimeId').value;
    
    // Update URL hash
    updateURLHash();
    
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
    // Update URL hash
    updateURLHash();
    
    // Re-display the current meals with the new filter
    if (window.currentMeals && window.currentMeals.length > 0) {
        displayMeals(window.currentMeals, 'takeinMealsResults');
    }
};

// Handle Take Out meal date change
window.onTakeoutMealDateChange = function() {
    const mealDate = document.getElementById('takeoutMealDate').value;
    const mealTimeId = document.getElementById('takeoutMealTimeId').value;
    
    // Update URL hash
    updateURLHash();
    
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
    
    // Update URL hash
    updateURLHash();
    
    // Only auto-fetch if we're on the takeout tab, have selected take-out restaurant, date, and meal time
    const takeoutTab = document.getElementById('takeout-tab');
    const isTakeoutTabActive = takeoutTab && takeoutTab.classList.contains('active');
    
    if (isTakeoutTabActive && selectedTakeoutRestaurant && mealDate && mealTimeId) {
        console.log('📦 Auto-fetching Take Out meals due to meal time change...');
        getTakeoutMeals();
    }
}

// Handle Take Out drinks filter change
window.onTakeoutFilterDrinksChange = function() {
    // Update URL hash
    updateURLHash();
    
    // Clear selections when filters change since item indices may change
    selectedTakeoutItems.clear();
    
    // Re-display the current take-out meals with the new filter
    if (window.currentMeals && window.currentMeals.length > 0 && window.currentMealsResultsId === 'takeoutMealsResults') {
        displayMeals(window.currentMeals, 'takeoutMealsResults');
    }
};

// Table sorting functionality - works for both desktop and mobile
function sortTable(tableId, columnIndex, dataType = 'string', sortDirection = null) {
    const table = document.getElementById(tableId) || document.querySelector(`#${tableId} table`) || document.querySelector('.meals-table');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const currentDirection = table.getAttribute('data-sort-direction') || 'asc';
    const newDirection = sortDirection || (currentDirection === 'asc' ? 'desc' : 'asc');
    
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
            // Extract numbers from text (handle "123 kcal", "45.2g" etc.)
            const aNum = parseFloat(aValue.replace(/[^\d.-]/g, '')) || 0;
            const bNum = parseFloat(bValue.replace(/[^\d.-]/g, '')) || 0;
            aValue = aNum;
            bValue = bNum;
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
    
    // Add mobile sort indicators to rows
    const headerText = targetHeader ? targetHeader.textContent.trim() : 'Column';
    table.classList.add('sorted');
    rows.forEach((row, index) => {
        const sortValue = row.cells[columnIndex] ? row.cells[columnIndex].textContent.trim() : '';
        const displayValue = dataType === 'number' ? parseFloat(sortValue.replace(/[^\d.-]/g, '')) || 0 : sortValue;
        row.setAttribute('data-sort-value', `${headerText}: ${displayValue}`);
    });
    
    table.setAttribute('data-sort-direction', newDirection);
    table.setAttribute('data-sort-column', columnIndex);
    table.setAttribute('data-sort-type', dataType);
    
    // Update mobile sort controls if they exist
    updateMobileSortIndicators(tableId, columnIndex, newDirection);
}

// Add mobile sort controls
function addMobileSortControls(tableElement, tableId, mealsData) {
    if (!tableElement) return;
    
    // Check if controls already exist
    let controlsContainer = tableElement.parentElement.querySelector('.mobile-table-controls');
    
    if (!controlsContainer) {
        controlsContainer = document.createElement('div');
        controlsContainer.className = 'mobile-table-controls';
        tableElement.parentElement.insertBefore(controlsContainer, tableElement);
    }
    
    // Get column headers
    const headers = Array.from(tableElement.querySelectorAll('thead th'));
    const columnOptions = headers.map((header, index) => {
        let dataType = 'string';
        if (header.classList.contains('nutrition-header') || 
            header.textContent.includes('P-Score') ||
            header.textContent.includes('Calories') || 
            header.textContent.includes('Carbs') || 
            header.textContent.includes('Sugar') || 
            header.textContent.includes('Fiber') || 
            header.textContent.includes('Fat') || 
            header.textContent.includes('Protein')) {
            dataType = 'number';
        }
        
        return {
            index,
            label: header.textContent.trim(),
            dataType
        };
    }).filter(col => col.label && col.label !== 'Action'); // Filter out empty headers and action columns
    
    controlsContainer.innerHTML = `
        <div class="mobile-sort-controls">
            <span class="mobile-sort-label">정렬:</span>
            <select class="mobile-sort-select" id="mobile-sort-${tableId}">
                <option value="">선택</option>
                ${columnOptions.map(col => `<option value="${col.index}" data-type="${col.dataType}">${col.label}</option>`).join('')}
            </select>
            <button class="mobile-sort-direction asc" id="mobile-sort-dir-${tableId}" title="정렬 방향 변경">
                오름차순
            </button>
        </div>
    `;
    
    // Add event listeners
    const sortSelect = controlsContainer.querySelector(`#mobile-sort-${tableId}`);
    const sortDirectionBtn = controlsContainer.querySelector(`#mobile-sort-dir-${tableId}`);
    
    sortSelect.addEventListener('change', (e) => {
        const selectedIndex = e.target.value;
        const selectedOption = e.target.options[e.target.selectedIndex];
        const dataType = selectedOption.getAttribute('data-type') || 'string';
        
        if (selectedIndex !== '') {
            const currentDirection = sortDirectionBtn.classList.contains('asc') ? 'asc' : 'desc';
            sortTable(tableId, parseInt(selectedIndex), dataType, currentDirection);
        }
    });
    
    sortDirectionBtn.addEventListener('click', () => {
        const isAsc = sortDirectionBtn.classList.contains('asc');
        const newDirection = isAsc ? 'desc' : 'asc';
        
        // Toggle button state
        sortDirectionBtn.classList.toggle('asc', !isAsc);
        sortDirectionBtn.classList.toggle('desc', isAsc);
        sortDirectionBtn.textContent = isAsc ? '내림차순' : '오름차순';
        
        // Apply sort if column is selected
        const selectedIndex = sortSelect.value;
        if (selectedIndex !== '') {
            const selectedOption = sortSelect.options[sortSelect.selectedIndex];
            const dataType = selectedOption.getAttribute('data-type') || 'string';
            sortTable(tableId, parseInt(selectedIndex), dataType, newDirection);
        }
    });
}

// Update mobile sort indicators
function updateMobileSortIndicators(tableId, columnIndex, direction) {
    const sortSelect = document.querySelector(`#mobile-sort-${tableId}`);
    const sortDirectionBtn = document.querySelector(`#mobile-sort-dir-${tableId}`);
    
    if (sortSelect && sortDirectionBtn) {
        // Update select to show current sorted column
        sortSelect.value = columnIndex;
        
        // Update direction button
        const isAsc = direction === 'asc';
        sortDirectionBtn.classList.toggle('asc', isAsc);
        sortDirectionBtn.classList.toggle('desc', !isAsc);
        sortDirectionBtn.textContent = isAsc ? '오름차순' : '내림차순';
    }
}

// Make table headers sortable and add mobile data labels
function makeTableSortable(tableElement, tableId) {
    if (!tableElement) return;
    
    const headers = tableElement.querySelectorAll('thead th');
    const rows = tableElement.querySelectorAll('tbody tr');
    
    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        header.setAttribute('title', header.textContent + ' (click to sort)');
        
        // Add data labels for mobile responsiveness
        const headerText = header.textContent.trim();
        rows.forEach(row => {
            const cell = row.cells[index];
            if (cell) {
                cell.setAttribute('data-label', headerText);
            }
        });
        
        // Determine data type based on column content
        let dataType = 'string';
        if (header.classList.contains('nutrition-header') || 
            header.textContent.includes('P-Score') ||
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

// P-Score calculation for weight loss (lower = better)
function calculatePScore(nutritionTotals) {
    if (!nutritionTotals) return null;
    
    const { calories = 0, carbs = 0, sugar = 0, fat = 0, protein = 0 } = nutritionTotals;
    
    // Weight loss P-Score formula (lower is better) - uses custom weights
    const pScore = 
        (calories * pScoreWeights.calorie) +    // Calories penalty 
        (carbs * pScoreWeights.carb) +          // Carbs penalty
        (sugar * pScoreWeights.sugar) +         // Sugar penalty 
        (fat * pScoreWeights.fat) -             // Fat penalty
        (protein * pScoreWeights.protein);      // Protein bonus (negative = good)
    
    return Math.max(0, Math.round(pScore * 10) / 10); // Round to 1 decimal, min 0
}

// P-Score settings management functions
window.updatePScoreWeights = function() {
    // Get values from form inputs
    pScoreWeights.calorie = parseFloat(document.getElementById('calorieWeight').value) || 0;
    pScoreWeights.carb = parseFloat(document.getElementById('carbWeight').value) || 0;
    pScoreWeights.sugar = parseFloat(document.getElementById('sugarWeight').value) || 0;
    pScoreWeights.fat = parseFloat(document.getElementById('fatWeight').value) || 0;
    pScoreWeights.protein = parseFloat(document.getElementById('proteinWeight').value) || 0;
    
    // Update URL hash
    updateURLHash();
    
    // Save to localStorage
    savePScoreSettings();
    
    // Update the formula display
    updatePScoreFormulaDisplay();
    
    // Re-calculate and display current meals with new weights
    refreshCurrentMealsWithNewPScore();
    
    console.log('⚖️ P-Score weights updated:', pScoreWeights);
};

window.resetPScoreWeights = function() {
    // Reset to default values
    pScoreWeights = { ...DEFAULT_PSCORE_WEIGHTS };
    
    // Update form inputs
    document.getElementById('calorieWeight').value = pScoreWeights.calorie;
    document.getElementById('carbWeight').value = pScoreWeights.carb;
    document.getElementById('sugarWeight').value = pScoreWeights.sugar;
    document.getElementById('fatWeight').value = pScoreWeights.fat;
    document.getElementById('proteinWeight').value = pScoreWeights.protein;
    
    // Update URL hash
    updateURLHash();
    
    // Save to localStorage
    savePScoreSettings();
    
    // Update the formula display
    updatePScoreFormulaDisplay();
    
    // Re-calculate and display current meals
    refreshCurrentMealsWithNewPScore();
    
    console.log('🔄 P-Score weights reset to defaults');
};

function updatePScoreFormulaDisplay() {
    const elements = {
        calorie: document.getElementById('currentCalorieWeight'),
        carb: document.getElementById('currentCarbWeight'),
        sugar: document.getElementById('currentSugarWeight'),
        fat: document.getElementById('currentFatWeight'),
        protein: document.getElementById('currentProteinWeight')
    };
    
    if (elements.calorie) elements.calorie.textContent = pScoreWeights.calorie;
    if (elements.carb) elements.carb.textContent = pScoreWeights.carb;
    if (elements.sugar) elements.sugar.textContent = pScoreWeights.sugar;
    if (elements.fat) elements.fat.textContent = pScoreWeights.fat;
    if (elements.protein) elements.protein.textContent = pScoreWeights.protein;
}

function refreshCurrentMealsWithNewPScore() {
    // Re-display current meals with updated P-Scores
    if (window.currentMeals && window.currentMeals.length > 0 && window.currentMealsResultsId) {
        displayMeals(window.currentMeals, window.currentMealsResultsId);
    }
}

function initializePScoreSettings() {
    // Load saved settings
    loadPScoreSettings();
    
    // Set form values (with safety checks)
    const calorieInput = document.getElementById('calorieWeight');
    const carbInput = document.getElementById('carbWeight');
    const sugarInput = document.getElementById('sugarWeight');
    const fatInput = document.getElementById('fatWeight');
    const proteinInput = document.getElementById('proteinWeight');
    
    if (calorieInput) calorieInput.value = pScoreWeights.calorie;
    if (carbInput) carbInput.value = pScoreWeights.carb;
    if (sugarInput) sugarInput.value = pScoreWeights.sugar;
    if (fatInput) fatInput.value = pScoreWeights.fat;
    if (proteinInput) proteinInput.value = pScoreWeights.protein;
    
    // Update formula display
    updatePScoreFormulaDisplay();
}

// Gallery functionality
let galleryMeals = [];
let filteredGalleryMeals = [];

// Load gallery data
window.loadGallery = async function() {
    const dateStr = document.getElementById('galleryDate').value;
    const mealTimeId = document.getElementById('galleryMealTimeId').value;
    
    if (!dateStr || !mealTimeId) {
        showStatus('galleryStatus', '날짜와 식사 시간을 선택하세요', 'error');
        return;
    }
    
    if (selectedRestaurants.length === 0) {
        showStatus('galleryStatus', '먼저 식당을 선택하세요', 'error');
        return;
    }
    
    try {
        showStatus('galleryStatus', '갤러리 로딩 중...', 'info');
        document.getElementById('galleryGrid').innerHTML = '<div class="gallery-loading">메뉴 이미지를 가져오는 중...</div>';
        
        const formattedDate = dateStr.includes('-') ? dateStr.replace(/-/g, '') : dateStr;
        galleryMeals = [];
        
        // Fetch meals from all selected restaurants
        for (const restaurant of selectedRestaurants) {
            try {
                const result = await apiCall('/restaurants/meals', {
                    restaurantData: restaurant,
                    date: formattedDate,
                    mealTimeId: mealTimeId
                });
                
                // Add restaurant info and filter meals with photos (Take-In only)
                const mealsWithPhotos = result.meals.filter(meal => {
                    // Only include meals with photos
                    if (!meal.photoUrl) return false;
                    
                    // Exclude meals containing "죽" (porridge)
                    if (meal.name && meal.name.includes('죽')) {
                        return false;
                    }
                    
                    // Take In: exclude meals with "T/O" prefix in course name, BUT include meals with "도시락" in name
                    if (meal.name && meal.name.includes('도시락')) {
                        return true; // 도시락 is always Take In
                    }
                    // Otherwise, exclude T/O meals
                    return !meal.menuCourseName || !(meal.menuCourseName.startsWith('T/O') || meal.menuCourseName.includes('Take out') || meal.menuCourseName.includes('선택음료') || meal.name.includes('시차제'));
                }).map(meal => ({
                    ...meal,
                    restaurantName: restaurant.name,
                    restaurantId: restaurant.id
                }));
                
                galleryMeals.push(...mealsWithPhotos);
                
            } catch (error) {
                console.warn(`Failed to get meals for ${restaurant.name}:`, error.message);
            }
        }
        
        // Remove duplicates based on meal name only (same menu items from different restaurants)
        const originalCount = galleryMeals.length;
        const uniqueMealsMap = new Map();
        
        galleryMeals.forEach(meal => {
            const uniqueKey = meal.name.trim().toLowerCase();
            if (!uniqueMealsMap.has(uniqueKey)) {
                uniqueMealsMap.set(uniqueKey, meal);
            } else {
                // If duplicate found, prefer the one with better photo URL or more recent data
                const existingMeal = uniqueMealsMap.get(uniqueKey);
                if (meal.photoUrl && (!existingMeal.photoUrl || meal.photoUrl.length > existingMeal.photoUrl.length)) {
                    uniqueMealsMap.set(uniqueKey, meal);
                }
            }
        });
        
        galleryMeals = Array.from(uniqueMealsMap.values());
        
        if (originalCount > galleryMeals.length) {
            console.log(`🔄 Removed ${originalCount - galleryMeals.length} duplicate meals from gallery`);
        }
        
        if (galleryMeals.length === 0) {
            showStatus('galleryStatus', '사진이 있는 메뉴를 찾을 수 없습니다', 'info');
            document.getElementById('galleryGrid').innerHTML = '<div class="gallery-empty">📷 사진이 있는 메뉴가 없습니다</div>';
            document.getElementById('galleryCount').textContent = '0개 이미지';
            return;
        }
        
        // Fetch nutrition data for P-Score calculation
        showStatus('galleryStatus', `${galleryMeals.length}개 고유 메뉴 사진 발견 - P-Score 계산 중...`, 'info');
        const mealsWithNutrition = await fetchNutritionForMeals(galleryMeals);
        galleryMeals = mealsWithNutrition;
        
        filteredGalleryMeals = [...galleryMeals];
        
        // Default sort by P-Score (lowest first - diet friendly)
        document.getElementById('gallerySortBy').value = 'pscore-asc';
        applySortToGallery('pscore-asc');
        
        showStatus('galleryStatus', `${galleryMeals.length}개의 테이크인 메뉴 사진을 P-Score 순으로 정렬했습니다`, 'success');
        
    } catch (error) {
        console.error('Gallery load error:', error);
        showStatus('galleryStatus', `갤러리 로드 실패: ${error.message}`, 'error');
    }
};

// Display gallery
function displayGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    const showLabels = document.getElementById('galleryShowLabels').checked;
    
    if (filteredGalleryMeals.length === 0) {
        galleryGrid.innerHTML = '<div class="gallery-empty">🔍 검색 조건에 맞는 메뉴가 없습니다</div>';
        document.getElementById('galleryCount').textContent = '0개 이미지';
        return;
    }
    
    galleryGrid.className = `gallery-grid${!showLabels ? ' no-labels' : ''}`;
    
    const sortBy = document.getElementById('gallerySortBy').value;
    const showRanking = sortBy && sortBy.startsWith('pscore');
    
    const galleryHTML = filteredGalleryMeals.map((meal, index) => {
        // Calculate P-Score
        let pScoreHTML = '';
        if (meal.nutritionTotals) {
            const pScore = calculatePScore(meal.nutritionTotals);
            const pScoreColor = pScore <= 50 ? '#22c55e' : pScore <= 100 ? '#f59e0b' : '#ef4444';
            pScoreHTML = `<span class="gallery-pscore" style="background-color: ${pScoreColor}20; color: ${pScoreColor}; border: 1px solid ${pScoreColor}40;">P-Score: ${pScore || 'N/A'}</span>`;
        } else {
            pScoreHTML = `<span class="gallery-pscore no-data">P-Score: N/A</span>`;
        }
        
        // Add ranking indicator for P-Score sorting
        let rankingHTML = '';
        if (showRanking && meal.nutritionTotals) {
            const rankNumber = index + 1;
            const rankEmoji = rankNumber <= 3 ? ['🥇', '🥈', '🥉'][rankNumber - 1] : `#${rankNumber}`;
            rankingHTML = `<div class="gallery-rank">${rankEmoji}</div>`;
        }
        
        return `
            <div class="gallery-item ${showRanking ? 'ranked' : ''}" onclick="showGalleryModal(${index})">
                ${rankingHTML}
                <img class="gallery-image loading" 
                     src="${meal.photoUrl}" 
                     alt="${meal.name}"
                     onload="this.classList.remove('loading')"
                     onerror="this.classList.add('error'); this.classList.remove('loading')">
                <div class="gallery-item-info">
                    <div class="gallery-item-title">${meal.name}</div>
                    <div class="gallery-item-meta">
                        <span class="gallery-restaurant-badge">📍 ${meal.restaurantName}</span>
                        <span class="gallery-meal-course">${meal.menuCourseName || ''}</span>
                    </div>
                    <div class="gallery-pscore-container">
                        ${pScoreHTML}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    galleryGrid.innerHTML = galleryHTML;
    document.getElementById('galleryCount').textContent = `${filteredGalleryMeals.length}개 이미지`;
}

// Filter gallery
window.filterGallery = function() {
    const searchElement = document.getElementById('gallerySearch');
    if (!searchElement) return;
    const searchTerm = searchElement.value.toLowerCase();
    
    if (!searchTerm) {
        filteredGalleryMeals = [...galleryMeals];
    } else {
        filteredGalleryMeals = galleryMeals.filter(meal =>
            meal.name.toLowerCase().includes(searchTerm) ||
            meal.restaurantName.toLowerCase().includes(searchTerm) ||
            (meal.menuCourseName && meal.menuCourseName.toLowerCase().includes(searchTerm))
        );
    }
    
    // Apply current sort after filtering
    const sortBy = document.getElementById('gallerySortBy').value;
    if (sortBy) {
        applySortToGallery(sortBy);
    } else {
        displayGallery();
    }
};

// Sort gallery
window.sortGallery = function() {
    // Update URL hash
    updateURLHash();
    
    const sortBy = document.getElementById('gallerySortBy').value;
    
    if (!sortBy) {
        displayGallery();
        return;
    }
    
    applySortToGallery(sortBy);
};

// Apply sorting to gallery
function applySortToGallery(sortBy) {
    const [criterion, direction] = sortBy.split('-');
    
    filteredGalleryMeals.sort((a, b) => {
        let aValue, bValue;
        
        switch (criterion) {
            case 'pscore':
                aValue = a.nutritionTotals ? calculatePScore(a.nutritionTotals) : 999999; // Put items without P-Score at end
                bValue = b.nutritionTotals ? calculatePScore(b.nutritionTotals) : 999999;
                break;
            case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
            case 'restaurant':
                aValue = a.restaurantName.toLowerCase();
                bValue = b.restaurantName.toLowerCase();
                break;
            default:
                return 0;
        }
        
        let comparison = 0;
        if (typeof aValue === 'number') {
            comparison = aValue - bValue;
        } else {
            if (aValue > bValue) comparison = 1;
            else if (aValue < bValue) comparison = -1;
        }
        
        return direction === 'desc' ? -comparison : comparison;
    });
    
    displayGallery();
}

// Toggle gallery labels
window.toggleGalleryLabels = function() {
    // Update URL hash
    updateURLHash();
    
    displayGallery();
};

// Clear gallery (internal function)
function clearGallery() {
    galleryMeals = [];
    filteredGalleryMeals = [];
    document.getElementById('galleryGrid').innerHTML = '<div class="gallery-empty">📸 식당을 선택하고 날짜/시간을 설정하면 자동으로 갤러리가 표시됩니다</div>';
    document.getElementById('galleryCount').textContent = '0개 이미지';
    const gallerySearch = document.getElementById('gallerySearch');
    if (gallerySearch) gallerySearch.value = '';
    const gallerySortBy = document.getElementById('gallerySortBy');
    if (gallerySortBy) gallerySortBy.value = '';
}

// Show gallery modal
window.showGalleryModal = function(index) {
    const meal = filteredGalleryMeals[index];
    if (!meal) return;
    
    // Calculate P-Score and nutrition info
    let nutritionHTML = '';
    if (meal.nutritionTotals) {
        const pScore = calculatePScore(meal.nutritionTotals);
        const pScoreColor = pScore <= 50 ? '#22c55e' : pScore <= 100 ? '#f59e0b' : '#ef4444';
        
        nutritionHTML = `
            <div class="gallery-modal-nutrition">
                <div class="gallery-modal-pscore" style="background-color: ${pScoreColor}20; color: ${pScoreColor}; border: 2px solid ${pScoreColor}60;">
                    <strong>P-Score: ${pScore || 'N/A'}</strong>
                </div>
                <div class="gallery-modal-nutrition-details">
                    <div class="nutrition-item">
                        <span class="nutrition-label">칼로리:</span>
                        <span class="nutrition-value">${Math.floor((meal.nutritionTotals.calories || 0)*100)/100} kcal</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="nutrition-label">탄수화물:</span>
                        <span class="nutrition-value">${Math.floor((meal.nutritionTotals.carbs || 0)*100)/100}g</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="nutrition-label">당분:</span>
                        <span class="nutrition-value">${Math.floor((meal.nutritionTotals.sugar || 0)*100)/100}g</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="nutrition-label">지방:</span>
                        <span class="nutrition-value">${Math.floor((meal.nutritionTotals.fat || 0)*100)/100}g</span>
                    </div>
                    <div class="nutrition-item">
                        <span class="nutrition-label">단백질:</span>
                        <span class="nutrition-value">${Math.floor((meal.nutritionTotals.protein || 0)*100)/100}g</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        nutritionHTML = `
            <div class="gallery-modal-nutrition">
                <div class="gallery-modal-pscore no-data">
                    <strong>P-Score: N/A</strong>
                </div>
                <p style="font-size: 14px; color: #9ca3af; font-style: italic;">영양 정보를 불러올 수 없습니다</p>
            </div>
        `;
    }
    
    const modal = document.createElement('div');
    modal.className = 'gallery-modal';
    modal.innerHTML = `
        <div class="gallery-modal-content">
            <button class="gallery-modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            <img class="gallery-modal-image" src="${meal.photoUrl}" alt="${meal.name}">
            <div class="gallery-modal-info">
                <div class="gallery-modal-title">${meal.name}</div>
                <div class="gallery-modal-meta">
                    <span class="gallery-restaurant-badge">📍 ${meal.restaurantName}</span>
                    <span>${meal.menuCourseName || ''}</span>
                </div>
                ${meal.subMenuTxt ? `<p style="margin-top: 8px; font-size: 14px; color: #6b7280;">${meal.subMenuTxt}</p>` : ''}
                ${nutritionHTML}
            </div>
        </div>
    `;
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    };
    
    document.body.appendChild(modal);
};

// Gallery date change handler
window.onGalleryDateChange = function() {
    // Update URL hash
    updateURLHash();
    
    // Auto-load if all required fields are filled
    const mealDate = document.getElementById('galleryDate').value;
    const mealTimeId = document.getElementById('galleryMealTimeId').value;
    
    if (mealDate && mealTimeId && selectedRestaurants.length > 0) {
        console.log('🖼️  Auto-loading gallery due to date change...');
        loadGallery();
    }
};

// Gallery meal time change handler
window.onGalleryMealTimeChange = function() {
    // Update URL hash
    updateURLHash();
    
    // Auto-load if all required fields are filled
    const mealDate = document.getElementById('galleryDate').value;
    const mealTimeId = document.getElementById('galleryMealTimeId').value;
    
    if (mealDate && mealTimeId && selectedRestaurants.length > 0) {
        console.log('🖼️  Auto-loading gallery due to meal time change...');
        loadGallery();
    }
};

// Update gallery meal time selector
function updateGalleryMealTimeSelect() {
    const gallerySelect = document.getElementById('galleryMealTimeId');
    
    if (gallerySelect && allMealTimes.length > 0) {
        const optionsHTML = '<option value="">식사 시간 선택</option>' + 
            allMealTimes.map(mealTime => 
                `<option value="${mealTime.id}">${mealTime.name}</option>`
            ).join('');
        
        const currentValue = gallerySelect.value;
        gallerySelect.innerHTML = optionsHTML;
        
        if (currentValue && allMealTimes.some(mt => mt.id === currentValue)) {
            gallerySelect.value = currentValue;
        } else {
            // Auto-select meal time based on current time
            const autoSelectedMealTime = getAutoMealTimeSelection();
            if (autoSelectedMealTime) {
                gallerySelect.value = autoSelectedMealTime;
                console.log('🕐 Auto-selected meal time for gallery:', allMealTimes.find(mt => mt.id === autoSelectedMealTime)?.name);
            }
        }
    }
}

// Auto-select meal time based on current time
function getAutoMealTimeSelection() {
    if (allMealTimes.length === 0) return null;
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // Find the most appropriate meal time based on current time
    // Priority mapping: 
    // 6-10: 조식 (breakfast)
    // 10-15: 중식 (lunch) 
    // 15-21: 석식 (dinner)
    // 21-6: 조식 (next day breakfast)
    
    let preferredMealNames = [];
    if (currentHour >= 6 && currentHour < 10) {
        preferredMealNames = ['조식', '아침'];
    } else if (currentHour >= 10 && currentHour < 15) {
        preferredMealNames = ['중식', '점심'];
    } else if (currentHour >= 15 && currentHour < 21) {
        preferredMealNames = ['석식', '저녁', '夕食'];
    } else {
        // Late night or early morning - default to breakfast for next day
        preferredMealNames = ['조식', '아침'];
    }
    
    // Try to find exact match first
    for (const preferredName of preferredMealNames) {
        const mealTime = allMealTimes.find(mt => 
            mt.name.includes(preferredName)
        );
        if (mealTime) {
            return mealTime.id;
        }
    }
    
    // If no exact match, return the first available meal time
    return allMealTimes[0]?.id || null;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Load any saved restaurant selections
    loadSelectedRestaurants();
    loadTakeoutRestaurant();
    updateSelectedRestaurantsList();
    updateTakeoutRestaurantDropdown();
    updateTakeoutRestaurantDisplay();
    
    // Initialize P-Score settings
    initializePScoreSettings();
    
    // Set default dates to today
    const today = new Date();
    const todayString = today.getFullYear().toString() + '-' + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + '-' + 
                       today.getDate().toString().padStart(2, '0');
    document.getElementById('takeinMealDate').value = todayString;
    document.getElementById('takeoutMealDate').value = todayString;
    document.getElementById('galleryDate').value = todayString;

    // Fetch meal times for any loaded restaurants before initializing gallery
    if (selectedRestaurants.length > 0) {
        await autoFetchMealTimes();
    }

    // Initialize gallery tab as default
    initializeGalleryTab();
    
    // Initialize URL state management for shareable links (after restaurant data is loaded)
    initializeURLStateManagement();
});

// Initialize gallery tab on page load
function initializeGalleryTab() {
    // Initialize with empty gallery
    clearGallery();
    
    // Show appropriate guidance based on current state
    if (selectedRestaurants.length === 0) {
        showStatus('galleryStatus', '📍 먼저 "🍽️ 식당 설정" 탭에서 식당을 선택하세요', 'info');
    } else if (allMealTimes.length === 0) {
        showStatus('galleryStatus', '⏳ 식사 시간 정보를 불러오는 중...', 'info');
    } else {
        // Meal times are available, check if we can auto-load
        checkAndAutoLoadGallery();
    }
}

// Check if gallery can auto-load and do so if conditions are met
function checkAndAutoLoadGallery() {
    const mealDate = document.getElementById('galleryDate').value;
    const mealTimeId = document.getElementById('galleryMealTimeId').value;
    
    if (mealDate && mealTimeId && selectedRestaurants.length > 0) {
        // All conditions met - auto-load gallery
        console.log('🖼️  Auto-loading gallery with auto-selected meal time...');
        showStatus('galleryStatus', '🤖 현재 시간에 맞는 식사로 갤러리를 자동 로딩합니다...', 'info');
        setTimeout(() => {
            loadGallery();
        }, 100); // Minimal delay to show the auto-loading message
    } else if (!mealDate) {
        showStatus('galleryStatus', '📅 날짜가 설정되지 않았습니다', 'info');
    } else if (!mealTimeId) {
        showStatus('galleryStatus', '🕐 식사 시간을 선택하세요', 'info');
    } else {
        showStatus('galleryStatus', '📅 날짜와 식사 시간을 선택한 후 "갤러리 로드" 버튼을 클릭하세요', 'info');
    }
}

// Mobile table view toggle function
window.toggleMobileTableView = function(tabType, viewType) {
    console.log(`🔄 Switching ${tabType} table to ${viewType} view`);
    
    // Update URL hash
    updateURLHash();
    
    // Re-display current meals with the new view mode
    if (window.currentMeals && window.currentMealsResultsId) {
        const currentResultsId = window.currentMealsResultsId;
        
        // Only refresh if it's the correct tab
        if ((tabType === 'takein' && currentResultsId === 'takeinMealsResults') ||
            (tabType === 'takeout' && currentResultsId === 'takeoutMealsResults')) {
            
            console.log(`🔄 Refreshing ${tabType} table with ${viewType} view`);
            displayMeals(window.currentMeals, currentResultsId);
        }
    }
};

// Takeout multi-select functionality
window.toggleTakeoutItemSelection = function(index) {
    if (selectedTakeoutItems.has(index)) {
        selectedTakeoutItems.delete(index);
    } else {
        selectedTakeoutItems.add(index);
    }
    
    // Update URL hash
    updateURLHash();
    
    updateSelectionUI();
    updateSelectedItemRow(index);
};

window.selectAllTakeoutItems = function() {
    if (!window.currentTakeoutItems) return;
    
    selectedTakeoutItems.clear();
    for (let i = 0; i < window.currentTakeoutItems.length; i++) {
        selectedTakeoutItems.add(i);
    }
    
    // Update URL hash
    updateURLHash();
    
    updateSelectionUI();
    updateAllItemRows();
};

window.clearTakeoutSelection = function() {
    selectedTakeoutItems.clear();
    
    // Update URL hash
    updateURLHash();
    
    updateSelectionUI();
    updateAllItemRows();
};

function updateSelectionUI() {
    const selectedCount = selectedTakeoutItems.size;
    const countElement = document.getElementById('selectedCount');
    const aggregatedBtn = document.getElementById('showAggregatedBtn');
    
    if (countElement) {
        countElement.textContent = selectedCount;
    }
    
    if (aggregatedBtn) {
        aggregatedBtn.disabled = selectedCount === 0;
    }
    
    // Auto-update floating box on PC
    updateAggregatedNutritionDisplay();
}

function updateSelectedItemRow(index) {
    const checkbox = document.getElementById(`takeout-item-${index}`);
    const row = checkbox?.closest('tr');
    
    if (checkbox && row) {
        checkbox.checked = selectedTakeoutItems.has(index);
        row.classList.toggle('selected-takeout-item', selectedTakeoutItems.has(index));
    }
}

function updateAllItemRows() {
    if (!window.currentTakeoutItems) return;
    
    for (let i = 0; i < window.currentTakeoutItems.length; i++) {
        updateSelectedItemRow(i);
    }
}

window.showAggregatedNutrition = function() {
    if (!window.currentTakeoutItems || selectedTakeoutItems.size === 0) {
        alert('선택된 항목이 없습니다.');
        return;
    }
    
    // Calculate aggregated nutrition
    const selectedItems = Array.from(selectedTakeoutItems).map(index => window.currentTakeoutItems[index]);
    
    const aggregatedNutrition = calculateAggregatedNutrition(selectedItems);
    
    // Check if device is PC (screen width > 1024px)
    if (window.innerWidth > 1024) {
        showAggregatedNutritionFloat(selectedItems, aggregatedNutrition);
    } else {
        showAggregatedNutritionModal(selectedItems, aggregatedNutrition);
    }
};

function calculateAggregatedNutrition(items) {
    return items.reduce((totals, item) => {
        return {
            calories: totals.calories + (item.calorie || 0),
            carbs: totals.carbs + (item.carbohydrate || 0),
            sugar: totals.sugar + (item.sugar || 0),
            fiber: totals.fiber + (item.fiber || 0),
            fat: totals.fat + (item.fat || 0),
            protein: totals.protein + (item.protein || 0)
        };
    }, {
        calories: 0,
        carbs: 0,
        sugar: 0,
        fiber: 0,
        fat: 0,
        protein: 0
    });
}

function showAggregatedNutritionModal(selectedItems, aggregatedNutrition) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    
    // Calculate aggregate P-Score
    const aggregatedPScore = calculatePScore(aggregatedNutrition);
    const pScoreColor = aggregatedPScore <= 50 ? '#22c55e' : aggregatedPScore <= 100 ? '#f59e0b' : '#ef4444';
    
    const content = `
        <div style="max-height: 80vh; overflow-y: auto;">
            <h2 style="margin-bottom: 20px;">📊 선택된 ${selectedItems.length}개 항목 통합 영양성분</h2>
            
            <!-- Aggregated Totals -->
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #374151; margin-bottom: 15px;">🧮 통합 영양성분</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px;">
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
                        <div style="font-size: 14px; color: #6b7280;">P-Score</div>
                        <div style="font-size: 18px; font-weight: bold; color: ${pScoreColor};">${aggregatedPScore?.toFixed(1) || 'N/A'}</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
                        <div style="font-size: 14px; color: #6b7280;">칼로리</div>
                        <div style="font-size: 18px; font-weight: bold;">${aggregatedNutrition.calories.toFixed(1)} kcal</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
                        <div style="font-size: 14px; color: #6b7280;">탄수화물</div>
                        <div style="font-size: 18px; font-weight: bold;">${aggregatedNutrition.carbs.toFixed(1)}g</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
                        <div style="font-size: 14px; color: #6b7280;">당분</div>
                        <div style="font-size: 18px; font-weight: bold;">${aggregatedNutrition.sugar.toFixed(1)}g</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
                        <div style="font-size: 14px; color: #6b7280;">지방</div>
                        <div style="font-size: 18px; font-weight: bold;">${aggregatedNutrition.fat.toFixed(1)}g</div>
                    </div>
                    <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
                        <div style="font-size: 14px; color: #6b7280;">단백질</div>
                        <div style="font-size: 18px; font-weight: bold;">${aggregatedNutrition.protein.toFixed(1)}g</div>
                    </div>
                </div>
            </div>
            
            <!-- Selected Items List -->
            <h3 style="color: #374151; margin-bottom: 15px;">📋 선택된 항목들</h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f3f4f6;">
                        <th style="padding: 10px; text-align: left; border: 1px solid #d1d5db;">메뉴</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">칼로리</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">탄수화물</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">당분</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">지방</th>
                        <th style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">단백질</th>
                    </tr>
                </thead>
                <tbody>
                    ${selectedItems.map(item => `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #d1d5db;">
                                <strong>${item.name}</strong><br>
                                <small style="color: #6b7280;">${item.restaurantName} - ${item.mealName}</small>
                            </td>
                            <td style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">${(item.calorie || 0).toFixed(1)}</td>
                            <td style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">${(item.carbohydrate || 0).toFixed(1)}g</td>
                            <td style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">${(item.sugar || 0).toFixed(1)}g</td>
                            <td style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">${(item.fat || 0).toFixed(1)}g</td>
                            <td style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">${(item.protein || 0).toFixed(1)}g</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90vw; width: 900px;">
            <span class="close" onclick="this.parentElement.parentElement.remove()">&times;</span>
            ${content}
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
};

// Handle Enter key press in restaurant search input
window.handleRestaurantSearchKeyPress = function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        searchRestaurants();
    }
};

// Floating nutrition box functionality
function showAggregatedNutritionFloat(selectedItems, aggregatedNutrition) {
    // Remove existing floating box if any
    hideAggregatedNutritionFloat();
    
    const aggregatedPScore = calculatePScore(aggregatedNutrition);
    const pScoreColor = aggregatedPScore <= 50 ? '#22c55e' : aggregatedPScore <= 100 ? '#f59e0b' : '#ef4444';
    
    const floatBox = document.createElement('div');
    floatBox.className = 'aggregated-nutrition-float';
    floatBox.id = 'aggregatedNutritionFloat';
    
    floatBox.innerHTML = `
        <div class="float-header">
            <h3 class="float-title">📊 선택된 ${selectedItems.length}개 항목</h3>
            <button class="float-close" onclick="hideAggregatedNutritionFloat()">&times;</button>
        </div>
        <div class="float-content">
            <div class="selected-items-count">
                ${selectedItems.map(item => item.name).join(', ')}
            </div>
            
            <div class="nutrition-summary">
                <div class="nutrition-item pscore-item">
                    <div class="nutrition-label">P-Score</div>
                    <div class="nutrition-value pscore-value" style="color: ${pScoreColor};">
                        ${aggregatedPScore?.toFixed(1) || 'N/A'}
                    </div>
                </div>
                <div class="nutrition-item">
                    <div class="nutrition-label">칼로리</div>
                    <div class="nutrition-value">${aggregatedNutrition.calories.toFixed(1)}</div>
                </div>
                <div class="nutrition-item">
                    <div class="nutrition-label">탄수화물</div>
                    <div class="nutrition-value">${aggregatedNutrition.carbs.toFixed(1)}g</div>
                </div>
                <div class="nutrition-item">
                    <div class="nutrition-label">당분</div>
                    <div class="nutrition-value">${aggregatedNutrition.sugar.toFixed(1)}g</div>
                </div>
                <div class="nutrition-item">
                    <div class="nutrition-label">지방</div>
                    <div class="nutrition-value">${aggregatedNutrition.fat.toFixed(1)}g</div>
                </div>
                <div class="nutrition-item">
                    <div class="nutrition-label">단백질</div>
                    <div class="nutrition-value">${aggregatedNutrition.protein.toFixed(1)}g</div>
                </div>
            </div>
            
            <div class="float-actions">
                <button class="btn-float" onclick="hideAggregatedNutritionFloat()">닫기</button>
                <button class="btn-float btn-primary" onclick="showDetailedNutritionModal()">상세보기</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(floatBox);
    
    // Trigger animation
    setTimeout(() => {
        floatBox.classList.add('visible');
    }, 50);
    
    // Store data for detailed view
    window.currentFloatData = { selectedItems, aggregatedNutrition };
}

function hideAggregatedNutritionFloat() {
    const floatBox = document.getElementById('aggregatedNutritionFloat');
    if (floatBox) {
        floatBox.classList.remove('visible');
        setTimeout(() => {
            floatBox.remove();
        }, 300);
    }
}

function showDetailedNutritionModal() {
    if (window.currentFloatData) {
        showAggregatedNutritionModal(window.currentFloatData.selectedItems, window.currentFloatData.aggregatedNutrition);
        hideAggregatedNutritionFloat();
    }
}

// Auto-update floating box when selections change
function updateAggregatedNutritionDisplay() {
    const floatBox = document.getElementById('aggregatedNutritionFloat');
    
    if (window.innerWidth > 1024) {
        // PC: Show floating box if items are selected
        if (selectedTakeoutItems.size === 0) {
            hideAggregatedNutritionFloat();
        } else if (window.currentTakeoutItems && selectedTakeoutItems.size > 0) {
            const selectedItems = Array.from(selectedTakeoutItems).map(index => window.currentTakeoutItems[index]);
            const aggregatedNutrition = calculateAggregatedNutrition(selectedItems);
            showAggregatedNutritionFloat(selectedItems, aggregatedNutrition);
        }
        // Hide mobile toolbar on PC
        hideMobileNutritionToolbar();
    } else {
        // Mobile/Tablet: Hide floating box if visible and show mobile toolbar
        if (floatBox) {
            hideAggregatedNutritionFloat();
        }
        updateMobileNutritionToolbar();
    }
}

// Mobile toolbar functionality
function showMobileNutritionToolbar(selectedItems) {
    // Remove existing toolbar if any
    hideMobileNutritionToolbar();
    
    const toolbar = document.createElement('div');
    toolbar.className = 'mobile-nutrition-toolbar';
    toolbar.id = 'mobileNutritionToolbar';
    
    const itemNames = selectedItems.map(item => item.name).join(', ');
    const truncatedNames = itemNames.length > 40 ? itemNames.substring(0, 40) + '...' : itemNames;
    
    toolbar.innerHTML = `
        <div class="toolbar-content">
            <div class="selected-info">
                <div class="selected-count">📊 ${selectedItems.length}개 항목 선택</div>
                <div class="selected-items">${truncatedNames}</div>
            </div>
            <button class="toolbar-button" onclick="showNutritionFromToolbar()">
                영양성분 보기
            </button>
        </div>
    `;
    
    document.body.appendChild(toolbar);
    
    // Trigger animation
    setTimeout(() => {
        toolbar.classList.add('visible');
    }, 50);
}

function hideMobileNutritionToolbar() {
    const toolbar = document.getElementById('mobileNutritionToolbar');
    if (toolbar) {
        toolbar.classList.remove('visible');
        setTimeout(() => {
            toolbar.remove();
        }, 300);
    }
}

function updateMobileNutritionToolbar() {
    if (selectedTakeoutItems.size === 0) {
        hideMobileNutritionToolbar();
    } else if (window.currentTakeoutItems && selectedTakeoutItems.size > 0) {
        const selectedItems = Array.from(selectedTakeoutItems).map(index => window.currentTakeoutItems[index]);
        showMobileNutritionToolbar(selectedItems);
    }
}

// Mobile toolbar button action
window.showNutritionFromToolbar = function() {
    if (!window.currentTakeoutItems || selectedTakeoutItems.size === 0) {
        return;
    }
    
    const selectedItems = Array.from(selectedTakeoutItems).map(index => window.currentTakeoutItems[index]);
    const aggregatedNutrition = calculateAggregatedNutrition(selectedItems);
    showAggregatedNutritionModal(selectedItems, aggregatedNutrition);
};

// Handle window resize to switch between floating box and modal
window.addEventListener('resize', function() {
    updateAggregatedNutritionDisplay();
});

// URL State Management - Shareable URLs with hash fragments
function updateURLHash() {
    try {
        const state = getCurrentViewState();
        const hash = encodeViewState(state);
        
        // Update URL without triggering reload
        if (window.location.hash !== hash) {
            history.replaceState(null, null, hash);
            console.log('📍 Updated URL hash:', hash);
        }
    } catch (error) {
        console.error('❌ Error updating URL hash:', error);
    }
}

function getCurrentViewState() {
    // Get current active tab
    const activeTab = document.querySelector('.header-tab-btn.active')?.textContent?.trim() || 'gallery';
    let tabName = 'gallery'; // default
    
    if (activeTab.includes('식당 설정')) tabName = 'restaurants';
    else if (activeTab.includes('테이크 인')) tabName = 'takein';
    else if (activeTab.includes('테이크 아웃')) tabName = 'takeout';
    else if (activeTab.includes('갤러리')) tabName = 'gallery';
    else if (activeTab.includes('설정')) tabName = 'system';
    
    const state = {
        tab: tabName,
        date: null,
        mealTime: null,
        filters: {},
        sort: null,
        view: {}
    };
    
    // Get date and meal time based on current tab
    if (tabName === 'takein') {
        state.date = document.getElementById('takeinMealDate')?.value;
        state.mealTime = document.getElementById('takeinMealTimeId')?.value;
        state.filters.mainOnly = document.getElementById('takeinFilterMainOnly')?.checked;
        state.filters.excludeOptional = document.getElementById('takeinFilterExcludeOptional')?.checked;
        state.view.tableView = document.querySelector('input[name="takeinTableView"]:checked')?.value;
        
        // Capture table sort state
        const takeinTable = document.querySelector('#takeinMealsResults .meals-table');
        if (takeinTable) {
            const sortColumn = takeinTable.getAttribute('data-sort-column');
            const sortDirection = takeinTable.getAttribute('data-sort-direction');
            const sortType = takeinTable.getAttribute('data-sort-type');
            if (sortColumn && sortDirection) {
                state.tableSort = `${sortColumn}:${sortDirection}:${sortType || 'string'}`;
            }
        }
    } else if (tabName === 'takeout') {
        state.date = document.getElementById('takeoutMealDate')?.value;
        state.mealTime = document.getElementById('takeoutMealTimeId')?.value;
        state.filters.excludeDrinks = document.getElementById('takeoutFilterDrinks')?.checked;
        state.view.tableView = document.querySelector('input[name="takeoutTableView"]:checked')?.value;
        state.restaurant = document.getElementById('takeoutRestaurantSelect')?.value;
        
        // Capture table sort state
        const takeoutTable = document.querySelector('#takeoutMealsResults .meals-table');
        if (takeoutTable) {
            const sortColumn = takeoutTable.getAttribute('data-sort-column');
            const sortDirection = takeoutTable.getAttribute('data-sort-direction');
            const sortType = takeoutTable.getAttribute('data-sort-type');
            if (sortColumn && sortDirection) {
                state.tableSort = `${sortColumn}:${sortDirection}:${sortType || 'string'}`;
            }
        }
        // Note: selected items are not included for privacy/complexity
    } else if (tabName === 'gallery') {
        state.date = document.getElementById('galleryDate')?.value;
        state.mealTime = document.getElementById('galleryMealTimeId')?.value;
        state.sort = document.getElementById('gallerySortBy')?.value;
        state.filters.showLabels = document.getElementById('galleryShowLabels')?.checked;
    }
    
    return state;
}

function encodeViewState(state) {
    const params = new URLSearchParams();
    
    params.set('tab', state.tab);
    
    if (state.date) params.set('date', state.date);
    if (state.mealTime) params.set('meal', state.mealTime);
    if (state.sort) params.set('sort', state.sort);
    if (state.restaurant) params.set('restaurant', state.restaurant);
    if (state.tableSort) params.set('tableSort', state.tableSort);
    
    // Encode filters
    Object.entries(state.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            params.set(`f_${key}`, value.toString());
        }
    });
    
    // Encode view settings
    Object.entries(state.view).forEach(([key, value]) => {
        if (value) params.set(`v_${key}`, value);
    });
    
    return '#' + params.toString();
}

function decodeViewState(hash) {
    if (!hash || hash === '#') return null;
    
    const params = new URLSearchParams(hash.substring(1));
    
    const state = {
        tab: params.get('tab') || 'gallery',
        date: params.get('date'),
        mealTime: params.get('meal'),
        sort: params.get('sort'),
        restaurant: params.get('restaurant'),
        tableSort: params.get('tableSort'),
        filters: {},
        view: {}
    };
    
    // Decode filters
    for (const [key, value] of params.entries()) {
        if (key.startsWith('f_')) {
            const filterName = key.substring(2);
            state.filters[filterName] = value === 'true';
        } else if (key.startsWith('v_')) {
            const viewName = key.substring(2);
            state.view[viewName] = value;
        }
    }
    
    return state;
}

function applyViewState(state) {
    if (!state) {
        console.log('❌ No state to apply');
        return;
    }
    
    console.log('🔄 Applying view state:', state);
    console.log('🔄 Tab to switch to:', state.tab);
    
    // Switch to the correct tab
    switchToTab(state.tab);
    
    // Apply date and meal time
    if (state.date) {
        const dateInputs = ['takeinMealDate', 'takeoutMealDate', 'galleryDate'];
        dateInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = state.date;
        });
    }
    
    if (state.mealTime) {
        const mealTimeInputs = ['takeinMealTimeId', 'takeoutMealTimeId', 'galleryMealTimeId'];
        mealTimeInputs.forEach(id => {
            const select = document.getElementById(id);
            if (select && select.querySelector(`option[value="${state.mealTime}"]`)) {
                select.value = state.mealTime;
            }
        });
    }
    
    // Apply filters
    Object.entries(state.filters).forEach(([key, value]) => {
        const mapping = {
            'mainOnly': 'takeinFilterMainOnly',
            'excludeOptional': 'takeinFilterExcludeOptional',
            'excludeDrinks': 'takeoutFilterDrinks',
            'showLabels': 'galleryShowLabels'
        };
        
        const elementId = mapping[key];
        if (elementId) {
            const element = document.getElementById(elementId);
            if (element) element.checked = value;
        }
    });
    
    // Apply sort
    if (state.sort) {
        const sortSelect = document.getElementById('gallerySortBy');
        if (sortSelect) sortSelect.value = state.sort;
    }
    
    // Apply restaurant selection
    if (state.restaurant) {
        const restaurantSelect = document.getElementById('takeoutRestaurantSelect');
        if (restaurantSelect && restaurantSelect.querySelector(`option[value="${state.restaurant}"]`)) {
            restaurantSelect.value = state.restaurant;
        }
    }
    
    // Apply table sort
    if (state.tableSort) {
        const [columnIndex, direction, dataType] = state.tableSort.split(':');
        const currentTab = state.tab;
        let tableSelector = '';
        
        if (currentTab === 'takein') {
            tableSelector = '#takeinMealsResults .meals-table';
        } else if (currentTab === 'takeout') {
            tableSelector = '#takeoutMealsResults .meals-table';
        }
        
        if (tableSelector) {
            setTimeout(() => {
                const table = document.querySelector(tableSelector);
                if (table && table.querySelector('tbody')) {
                    sortTable(table.id || 'meals-table', parseInt(columnIndex), dataType || 'string', direction);
                }
            }, 500); // Delay to ensure table is loaded
        }
    }
    
    // Apply view settings
    Object.entries(state.view).forEach(([key, value]) => {
        if (key === 'tableView') {
            const radios = document.querySelectorAll(`input[name="${state.tab}TableView"]`);
            radios.forEach(radio => {
                if (radio.value === value) radio.checked = true;
            });
        }
    });
}

function switchToTab(tabName) {
    // Directly switch to tab without triggering URL update (used for applying URL state)
    console.log('🔄 Switching to tab:', tabName);
    
    const tabMap = {
        'restaurants': '식당 설정',
        'takein': '테이크 인',
        'takeout': '테이크 아웃',
        'gallery': '갤러리',
        'system': '설정'
    };
    
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    console.log('🔄 Found tab contents:', tabContents.length);
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.header-tab-btn');
    console.log('🔄 Found tab buttons:', tabButtons.length);
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabName + '-tab');
    console.log('🔄 Looking for tab ID:', tabName + '-tab');
    console.log('🔄 Found tab element:', selectedTab);
    if (selectedTab) {
        selectedTab.classList.add('active');
        console.log('✅ Tab activated:', tabName);
    } else {
        console.log('❌ Tab not found:', tabName + '-tab');
    }
    
    // Add active class to the correct button
    const targetText = tabMap[tabName];
    if (targetText) {
        const targetButton = Array.from(tabButtons).find(btn => btn.textContent.includes(targetText));
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
            }
        }
    } else if (tabName === 'takeout') {
        // Auto-fetch meals if we have everything needed
        if (selectedTakeoutRestaurant) {
            const mealDate = document.getElementById('takeoutMealDate').value;
            const mealTimeId = document.getElementById('takeoutMealTimeId').value;
            
            if (mealDate && mealTimeId) {
                console.log('📦 Auto-fetching Take Out meals...');
                getTakeoutMeals();
            }
        }
    } else if (tabName === 'gallery') {
        // Auto-load gallery if we have everything needed
        if (selectedRestaurants.length > 0) {
            const mealDate = document.getElementById('galleryDate').value;
            const mealTimeId = document.getElementById('galleryMealTimeId').value;
            
            if (mealDate && mealTimeId) {
                console.log('🖼️ Auto-loading gallery...');
                loadGallery();
            }
        }
    }
}

// Initialize URL state management
function initializeURLStateManagement() {
    console.log('🚀 Initializing URL state management');
    
    // Load state from URL on page load
    const hash = window.location.hash;
    console.log('🔍 Current hash:', hash);
    
    if (hash && hash !== '#') {
        console.log('📋 Decoding hash state...');
        const state = decodeViewState(hash);
        console.log('📋 Decoded state:', state);
        
        // Wait for restaurant dropdown to be populated before applying state
        const waitForRestaurantData = () => {
            const dropdown = document.getElementById('takeoutRestaurantSelect');
            console.log('⏳ Checking dropdown:', dropdown ? dropdown.children.length : 'not found');
            
            if (dropdown && dropdown.children.length > 1) {
                // Restaurant options are loaded
                console.log('✅ Restaurant dropdown ready, applying state');
                applyViewState(state);
            } else {
                // Check again in 100ms
                console.log('⏳ Waiting for restaurant data...');
                setTimeout(waitForRestaurantData, 100);
            }
        };
        
        setTimeout(waitForRestaurantData, 100); // Start checking after initial delay
    } else {
        console.log('ℹ️ No hash to process');
    }
    
    // Listen for hash changes (back/forward navigation)
    window.addEventListener('hashchange', function() {
        const state = decodeViewState(window.location.hash);
        applyViewState(state);
    });
    
    // Update URL when view changes
    const updateEvents = [
        'change', 'click', 'input'
    ];
    
    updateEvents.forEach(eventType => {
        document.addEventListener(eventType, function(e) {
            // Check for relevant form elements and tab buttons
            const isRelevantElement = (
                // Form inputs and selects
                (e.target.matches('input, select') && 
                 (e.target.id.includes('Date') || 
                  e.target.id.includes('Time') || 
                  e.target.id.includes('Filter') || 
                  e.target.id.includes('Sort') || 
                  e.target.id.includes('TableView') ||
                  e.target.id.includes('galleryShowLabels') ||
                  (e.target.name && e.target.name.includes('TableView')))) ||
                // Tab buttons
                (e.target.matches('button') && e.target.className.includes('header-tab-btn'))
            );
            
            if (isRelevantElement) {
                // Debounce URL updates (shorter delay for better responsiveness)
                clearTimeout(window.urlUpdateTimeout);
                window.urlUpdateTimeout = setTimeout(updateURLHash, 100);
            }
        });
    });
}

