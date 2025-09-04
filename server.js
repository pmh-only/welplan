import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WelstoryClient } from 'welstory-api-wrapper';

// Load environment variables
dotenv.config();

// Cache configuration
const CACHE_DIR = './cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('📁 Created cache directory');
}

// Cache utility functions
function getCacheKey(prefix, ...args) {
    const data = args.join('|');
    return `${prefix}_${crypto.createHash('md5').update(data).digest('hex')}`;
}

function getCachePath(key) {
    return path.join(CACHE_DIR, `${key}.json`);
}

function isCacheValid(filePath, ttl = CACHE_TTL) {
    try {
        const stats = fs.statSync(filePath);
        const age = Date.now() - stats.mtime.getTime();
        return age < ttl;
    } catch (error) {
        return false;
    }
}

function readCache(key, ttl = CACHE_TTL) {
    try {
        const filePath = getCachePath(key);
        if (isCacheValid(filePath, ttl)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn(`Cache read error for ${key}:`, error.message);
    }
    return null;
}

function writeCache(key, data) {
    try {
        const filePath = getCachePath(key);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.warn(`Cache write error for ${key}:`, error.message);
        return false;
    }
}

function clearCache(pattern = null) {
    try {
        const files = fs.readdirSync(CACHE_DIR);
        let deletedCount = 0;
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                if (!pattern || file.includes(pattern)) {
                    fs.unlinkSync(path.join(CACHE_DIR, file));
                    deletedCount++;
                }
            }
        }
        
        console.log(`🗑️  Cleared ${deletedCount} cache files${pattern ? ` matching '${pattern}'` : ''}`);
        return deletedCount;
    } catch (error) {
        console.warn('Cache clear error:', error.message);
        return 0;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Store active clients (in production, use Redis or database)
const clients = new Map();

// Store user info globally
let globalUserInfo = null;

// Helper function to get client
function getClient(sessionId) {
    if (!clients.has(sessionId)) {
        const client = new WelstoryClient({
            automaticTokenRefresh: process.env.WELSTORY_AUTO_REFRESH !== 'false',
            baseUrl: process.env.WELSTORY_BASE_URL
        });
        clients.set(sessionId, client);
    }
    return clients.get(sessionId);
}

// Auto-login function
async function autoLogin() {
    const username = process.env.WELSTORY_USERNAME;
    const password = process.env.WELSTORY_PASSWORD;
    
    if (!username || !password) {
        console.warn('⚠️  WELSTORY_USERNAME and WELSTORY_PASSWORD must be set in .env file');
        return false;
    }
    
    try {
        console.log('🔐 Auto-logging in with configured credentials...');
        const client = getClient('default');
        
        globalUserInfo = await client.login({
            username,
            password,
            automaticTokenRefresh: process.env.WELSTORY_AUTO_REFRESH !== 'false'
        });
        
        console.log('✅ Auto-login successful for user:', globalUserInfo.bizName);
        return true;
    } catch (error) {
        console.error('❌ Auto-login failed:', error.message);
        return false;
    }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Welstory API Backend is running' });
});

// Login (now just returns pre-authenticated user info)
app.post('/api/login', async (req, res) => {
    try {
        if (!globalUserInfo) {
            return res.status(400).json({ 
                error: 'Server not authenticated. Check credentials in .env file.' 
            });
        }

        res.json({
            success: true,
            userInfo: globalUserInfo,
            sessionId: 'default'
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(400).json({ 
            error: error.message || 'Login failed' 
        });
    }
});

// Refresh session
app.post('/api/refresh', async (req, res) => {
    try {
        const { sessionId } = req.body;
        const client = getClient(sessionId || 'default');
        
        const expiresIn = await client.refreshSession();
        
        res.json({
            success: true,
            expiresIn,
            expiresInMinutes: Math.floor(expiresIn / 60000)
        });

    } catch (error) {
        console.error('Refresh error:', error);
        res.status(400).json({ 
            error: error.message || 'Session refresh failed' 
        });
    }
});

// Search restaurants
app.post('/api/restaurants/search', async (req, res) => {
    try {
        const { searchQuery, sessionId } = req.body;
        
        if (!searchQuery) {
            return res.status(400).json({ 
                error: 'Search query is required' 
            });
        }

        const client = getClient(sessionId || 'default');
        const restaurants = await client.searchRestaurant(searchQuery);
        
        // Convert restaurant objects to plain objects for JSON serialization
        const restaurantData = restaurants.map(restaurant => ({
            id: restaurant.id,
            name: restaurant.name,
            description: restaurant.description
        }));
        
        res.json({
            success: true,
            restaurants: restaurantData,
            count: restaurantData.length
        });

    } catch (error) {
        console.error('Restaurant search error:', error);
        res.status(400).json({ 
            error: error.message || 'Restaurant search failed' 
        });
    }
});

// Check restaurant registration
app.post('/api/restaurants/check-registration', async (req, res) => {
    try {
        const { restaurantId, sessionId } = req.body;
        const client = getClient(sessionId || 'default');
        
        // Get the restaurant from client's search results
        const restaurants = await client.searchRestaurant(''); // This is not ideal, but we need the restaurant object
        const restaurant = restaurants.find(r => r.id === restaurantId);
        
        if (!restaurant) {
            return res.status(404).json({ 
                error: 'Restaurant not found' 
            });
        }
        
        const isRegistered = await restaurant.checkIsRegistered();
        
        res.json({
            success: true,
            isRegistered
        });

    } catch (error) {
        console.error('Registration check error:', error);
        res.status(400).json({ 
            error: error.message || 'Registration check failed' 
        });
    }
});

// Register restaurant
app.post('/api/restaurants/register', async (req, res) => {
    try {
        const { restaurantData, sessionId } = req.body;
        const client = getClient(sessionId || 'default');
        
        // Create restaurant object from data
        const { WelstoryRestaurant } = await import('welstory-api-wrapper');
        const restaurant = new WelstoryRestaurant(
            client,
            restaurantData.id,
            restaurantData.name,
            restaurantData.description
        );
        
        await restaurant.register();
        
        res.json({
            success: true,
            message: `Successfully registered ${restaurantData.name}`
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ 
            error: error.message || 'Registration failed' 
        });
    }
});

// Unregister restaurant
app.post('/api/restaurants/unregister', async (req, res) => {
    try {
        const { restaurantData, sessionId } = req.body;
        const client = getClient(sessionId || 'default');
        
        // Create restaurant object from data
        const { WelstoryRestaurant } = await import('welstory-api-wrapper');
        const restaurant = new WelstoryRestaurant(
            client,
            restaurantData.id,
            restaurantData.name,
            restaurantData.description
        );
        
        await restaurant.unregister();
        
        res.json({
            success: true,
            message: `Successfully unregistered ${restaurantData.name}`
        });

    } catch (error) {
        console.error('Unregistration error:', error);
        res.status(400).json({ 
            error: error.message || 'Unregistration failed' 
        });
    }
});

// Get meal times
app.post('/api/restaurants/meal-times', async (req, res) => {
    try {
        const { restaurantData, sessionId } = req.body;
        const client = getClient(sessionId || 'default');
        
        // Create restaurant object from data
        const { WelstoryRestaurant } = await import('welstory-api-wrapper');
        const restaurant = new WelstoryRestaurant(
            client,
            restaurantData.id,
            restaurantData.name,
            restaurantData.description
        );
        
        const mealTimes = await restaurant.listMealTimes();
        
        res.json({
            success: true,
            mealTimes
        });

    } catch (error) {
        console.error('Meal times error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to get meal times' 
        });
    }
});

// Get meals
app.post('/api/restaurants/meals', async (req, res) => {
    try {
        const { restaurantData, date, mealTimeId, sessionId } = req.body;
        
        // Create cache key based on restaurant ID, date, and meal time
        const cacheKey = getCacheKey('meals', restaurantData.id, date, mealTimeId);
        
        // Try to get from cache first
        let cachedData = readCache(cacheKey);
        if (cachedData) {
            console.log(`📋 Cache hit for meals: ${restaurantData.name} - ${date} - ${mealTimeId}`);
            return res.json({
                success: true,
                meals: cachedData,
                cached: true
            });
        }
        
        console.log(`🔄 Cache miss for meals: ${restaurantData.name} - ${date} - ${mealTimeId}`);
        const client = getClient(sessionId || 'default');
        
        // Create restaurant object from data
        const { WelstoryRestaurant } = await import('welstory-api-wrapper');
        const restaurant = new WelstoryRestaurant(
            client,
            restaurantData.id,
            restaurantData.name,
            restaurantData.description
        );
        
        const meals = await restaurant.listMeal(parseInt(date), mealTimeId);
        
        // Convert meal objects to plain objects
        const mealData = meals.map(meal => ({
            hallNo: meal.hallNo,
            date: meal.date,
            mealTimeId: meal.mealTimeId,
            name: meal.name,
            menuCourseName: meal.menuCourseName,
            menuCourseType: meal.menuCourseType,
            setName: meal.setName,
            subMenuTxt: meal.subMenuTxt,
            photoUrl: meal.photoUrl,
            // Store restaurant data for nutrition requests
            restaurantData: restaurantData
        }));
        
        // Cache the result
        writeCache(cacheKey, mealData);
        console.log(`💾 Cached meals data for ${restaurantData.name} - ${date} - ${mealTimeId}`);
        
        res.json({
            success: true,
            meals: mealData,
            cached: false
        });

    } catch (error) {
        console.error('Meals error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to get meals' 
        });
    }
});

// Get nutrition information for multiple meals (bulk)
app.post('/api/meals/nutrition/bulk', async (req, res) => {
    try {
        const { mealsData, sessionId } = req.body;
        
        if (!mealsData || !Array.isArray(mealsData)) {
            return res.status(400).json({ 
                error: 'mealsData array is required' 
            });
        }
        
        const client = getClient(sessionId || 'default');
        const { WelstoryRestaurant, WelstoryMeal } = await import('welstory-api-wrapper');
        
        const nutritionResults = [];
        
        console.log(`📊 Processing bulk nutrition request for ${mealsData.length} meals`);
        
        for (let i = 0; i < mealsData.length; i++) {
            const mealData = mealsData[i];
            
            try {
                // Create cache key for this specific meal nutrition
                const cacheKey = getCacheKey(
                    'nutrition',
                    mealData.restaurantData.id,
                    mealData.date,
                    mealData.mealTimeId,
                    mealData.hallNo,
                    mealData.name,
                    mealData.menuCourseName,
                    mealData.menuCourseType
                );
                
                // Try to get from cache first
                let cachedData = readCache(cacheKey);
                if (cachedData) {
                    console.log(`📋 Cache hit for nutrition: ${mealData.name}`);
                    nutritionResults.push({
                        mealIndex: i,
                        success: true,
                        nutritionData: cachedData,
                        mealName: mealData.name,
                        cached: true
                    });
                    continue;
                }
                
                console.log(`🔄 Cache miss for nutrition: ${mealData.name}`);
                
                const restaurant = new WelstoryRestaurant(
                    client,
                    mealData.restaurantData.id,
                    mealData.restaurantData.name,
                    mealData.restaurantData.description
                );
                
                const meal = new WelstoryMeal(
                    client,
                    restaurant,
                    mealData.hallNo,
                    mealData.date,
                    mealData.mealTimeId,
                    mealData.name,
                    mealData.menuCourseName,
                    mealData.menuCourseType,
                    mealData.setName,
                    mealData.subMenuTxt,
                    mealData.photoUrl
                );
                
                const nutritionData = await meal.listMealMenus();
                
                // Cache the result
                writeCache(cacheKey, nutritionData);
                console.log(`💾 Cached nutrition data for ${mealData.name}`);
                
                nutritionResults.push({
                    mealIndex: i,
                    success: true,
                    nutritionData,
                    mealName: mealData.name,
                    cached: false
                });
                
            } catch (error) {
                console.error(`❌ Failed to get nutrition for meal ${i} (${mealData.name}):`, error.message);
                nutritionResults.push({
                    mealIndex: i,
                    success: false,
                    error: error.message,
                    mealName: mealData.name
                });
            }
        }
        
        const successCount = nutritionResults.filter(r => r.success).length;
        const cacheHits = nutritionResults.filter(r => r.cached).length;
        
        console.log(`📊 Bulk nutrition complete: ${successCount}/${mealsData.length} successful, ${cacheHits} from cache`);
        
        res.json({
            success: true,
            results: nutritionResults,
            totalMeals: mealsData.length,
            successfulMeals: successCount,
            cacheHits
        });

    } catch (error) {
        console.error('Bulk nutrition error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to get bulk nutrition information' 
        });
    }
});

// Get nutrition information
app.post('/api/meals/nutrition', async (req, res) => {
    try {
        const { mealData, sessionId } = req.body;
        
        // Create cache key based on meal properties
        const cacheKey = getCacheKey(
            'nutrition',
            mealData.restaurantData.id,
            mealData.date,
            mealData.mealTimeId,
            mealData.hallNo,
            mealData.name,
            mealData.menuCourseName,
            mealData.menuCourseType
        );
        
        // Try to get from cache first
        let cachedData = readCache(cacheKey);
        if (cachedData) {
            console.log(`📊 Cache hit for nutrition: ${mealData.name}`);
            return res.json({
                success: true,
                nutritionData: cachedData,
                mealName: mealData.name,
                cached: true
            });
        }
        
        console.log(`🔄 Cache miss for nutrition: ${mealData.name}`);
        const client = getClient(sessionId || 'default');
        
        // Create restaurant and meal objects from data
        const { WelstoryRestaurant, WelstoryMeal } = await import('welstory-api-wrapper');
        
        const restaurant = new WelstoryRestaurant(
            client,
            mealData.restaurantData.id,
            mealData.restaurantData.name,
            mealData.restaurantData.description
        );
        
        const meal = new WelstoryMeal(
            client,
            restaurant,
            mealData.hallNo,
            mealData.date,
            mealData.mealTimeId,
            mealData.name,
            mealData.menuCourseName,
            mealData.menuCourseType,
            mealData.setName,
            mealData.subMenuTxt,
            mealData.photoUrl
        );
        
        const nutritionData = await meal.listMealMenus();
        
        // Cache the result
        writeCache(cacheKey, nutritionData);
        console.log(`💾 Cached nutrition data for ${mealData.name}`);
        
        res.json({
            success: true,
            nutritionData,
            mealName: mealData.name,
            cached: false
        });

    } catch (error) {
        console.error('Nutrition error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to get nutrition information' 
        });
    }
});

// Get menu items for a meal (for take-out detailed view)
app.post('/api/meals/menu-items', async (req, res) => {
    try {
        const { mealData, sessionId } = req.body;
        
        // Create cache key based on meal properties
        const cacheKey = getCacheKey(
            'menu_items',
            mealData.restaurantData.id,
            mealData.date,
            mealData.mealTimeId,
            mealData.hallNo,
            mealData.name,
            mealData.menuCourseName,
            mealData.menuCourseType
        );
        
        // Try to get from cache first
        let cachedData = readCache(cacheKey);
        if (cachedData) {
            console.log(`📋 Cache hit for menu items: ${mealData.name}`);
            return res.json({
                success: true,
                menuItems: cachedData,
                mealName: mealData.name,
                cached: true
            });
        }
        
        console.log(`🔄 Cache miss for menu items: ${mealData.name}`);
        const client = getClient(sessionId || 'default');
        
        // Create restaurant and meal objects from data
        const { WelstoryRestaurant, WelstoryMeal } = await import('welstory-api-wrapper');
        
        const restaurant = new WelstoryRestaurant(
            client,
            mealData.restaurantData.id,
            mealData.restaurantData.name,
            mealData.restaurantData.description
        );
        
        const meal = new WelstoryMeal(
            client,
            restaurant,
            mealData.hallNo,
            mealData.date,
            mealData.mealTimeId,
            mealData.name,
            mealData.menuCourseName,
            mealData.menuCourseType,
            mealData.setName,
            mealData.subMenuTxt,
            mealData.photoUrl
        );
        
        const menuItems = await meal.listMealMenus();
        
        // Cache the result
        writeCache(cacheKey, menuItems);
        console.log(`💾 Cached menu items data for ${mealData.name}`);
        
        res.json({
            success: true,
            menuItems,
            mealName: mealData.name,
            cached: false
        });

    } catch (error) {
        console.error('Menu items error:', error);
        res.status(400).json({ 
            error: error.message || 'Failed to get menu items' 
        });
    }
});

// Cache management endpoints

// Get cache status
app.get('/api/cache/status', (req, res) => {
    try {
        const files = fs.readdirSync(CACHE_DIR);
        const cacheFiles = files.filter(file => file.endsWith('.json'));
        
        const cacheStats = cacheFiles.map(file => {
            const filePath = path.join(CACHE_DIR, file);
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtime.getTime();
            const isValid = age < CACHE_TTL;
            
            return {
                file,
                size: stats.size,
                created: stats.mtime.toISOString(),
                age: Math.floor(age / 1000), // age in seconds
                isValid,
                ttl: Math.floor((CACHE_TTL - age) / 1000) // remaining TTL in seconds
            };
        });
        
        res.json({
            success: true,
            totalFiles: cacheFiles.length,
            validFiles: cacheStats.filter(stat => stat.isValid).length,
            expiredFiles: cacheStats.filter(stat => !stat.isValid).length,
            totalSize: cacheStats.reduce((sum, stat) => sum + stat.size, 0),
            cacheTTL: CACHE_TTL,
            files: cacheStats
        });
        
    } catch (error) {
        console.error('Cache status error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to get cache status' 
        });
    }
});

// Clear cache
app.post('/api/cache/clear', (req, res) => {
    try {
        const { pattern } = req.body;
        const deletedCount = clearCache(pattern);
        
        res.json({
            success: true,
            message: `Cleared ${deletedCount} cache files${pattern ? ` matching '${pattern}'` : ''}`,
            deletedCount
        });
        
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to clear cache' 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error' 
    });
});

// Start server with auto-login
app.listen(PORT, async () => {
    console.log(`🚀 Welstory API Backend running on http://localhost:${PORT}`);
    console.log(`📱 Frontend available at http://localhost:${PORT}`);
    console.log(`🔧 API endpoints available at http://localhost:${PORT}/api/`);
    
    // Attempt auto-login
    await autoLogin();
});
