import UIKit
import Capacitor
import BackgroundTasks
import WidgetKit // Add this import

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    
    // Background task identifier
    let backgroundRefreshTaskID = "com.valdivia.skywatch.app.refresh"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Register background tasks
        BGTaskScheduler.shared.register(forTaskWithIdentifier: backgroundRefreshTaskID, using: nil) { task in
            self.handleAppRefresh(task: task as! BGAppRefreshTask)
        }
        
        print("🔧 Skywatch: Background refresh registered")
        
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
        
        // IMMEDIATE FIX: Save data to widget whenever app enters background
        print("💾 Skywatch: App entering background - syncing data to widget...")
        self.saveWeatherDataToAppGroup()
        
        // Schedule next background refresh
        scheduleAppRefresh()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
    
    // MARK: - Background Refresh
    
    func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: backgroundRefreshTaskID)
        
        // Schedule next refresh in 15-30 minutes (moderate frequency)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60) // 15 minutes from now
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("⏰ Skywatch: Background refresh scheduled for \(request.earliestBeginDate!)")
        } catch {
            print("❌ Skywatch: Could not schedule app refresh: \(error)")
        }
    }
    
    func handleAppRefresh(task: BGAppRefreshTask) {
        print("🔄 Skywatch: Background refresh started")
        
        // Schedule next refresh before doing work
        scheduleAppRefresh()
        
        // Set expiration handler
        task.expirationHandler = {
            print("⚠️ Skywatch: Background task expired")
            task.setTaskCompleted(success: false)
        }
        
        // Perform weather data fetch
        fetchWeatherDataInBackground { success in
            print(success ? "✅ Skywatch: Background fetch completed" : "❌ Skywatch: Background fetch failed")
            task.setTaskCompleted(success: success)
        }
    }
    
    func fetchWeatherDataInBackground(completion: @escaping (Bool) -> Void) {
        // Get the bridge to call JavaScript
        guard let bridge = (UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? CAPBridgeViewController else {
            print("❌ Skywatch: Could not access Capacitor bridge")
            completion(false)
            return
        }
        
        // Call JavaScript function to fetch weather data
        // The JavaScript will use CapacitorHttp to fetch and save to localStorage
        bridge.webView?.evaluateJavaScript("updateData()") { result, error in
            if let error = error {
                print("❌ Skywatch: JavaScript error: \(error)")
                completion(false)
            } else {
                print("✅ Skywatch: Weather data updated in background")
                
                // Save to App Group for widget access
                self.saveWeatherDataToAppGroup()
                
                completion(true)
            }
        }
    }
    
    func saveWeatherDataToAppGroup() {
        // Get the bridge to access localStorage
        guard let bridge = (UIApplication.shared.delegate as? AppDelegate)?.window?.rootViewController as? CAPBridgeViewController else {
            return
        }
        
        // Read weather data from JavaScript localStorage
        bridge.webView?.evaluateJavaScript("localStorage.getItem('weather_history')") { result, error in
            if let error = error {
                print("❌ Skywatch: JS Eval Error: \(error)")
                return
            }
            
            guard let historyJSON = result as? String else {
                print("⚠️ Skywatch: 'weather_history' is null or not a string in localStorage")
                return
            }
            
            print("📦 Skywatch: Retrieved history from JS (Length: \(historyJSON.count))")
            
            if let historyData = historyJSON.data(using: .utf8) {
                // Method 1: UserDefaults (Backup)
                if let sharedDefaults = UserDefaults(suiteName: "group.com.valdivia.skywatch.app") {
                    sharedDefaults.set(historyData, forKey: "weather_history")
                    sharedDefaults.synchronize()
                }
                
                // Method 2: File System (Primary - More reliable for Simulator)
                if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.valdivia.skywatch.app") {
                    let fileURL = containerURL.appendingPathComponent("weather_data.json")
                    do {
                        try historyData.write(to: fileURL)
                        print("💾 Skywatch: Weather data written to file: \(fileURL.path)")
                    } catch {
                        print("❌ Skywatch: Failed to write file: \(error)")
                    }
                }
                
                // Force widget reload immediately!
                if #available(iOS 14.0, *) {
                    WidgetCenter.shared.reloadAllTimelines()
                    print("⚡️ Skywatch: Widget reload triggered")
                }
            }
        }
    }

}
