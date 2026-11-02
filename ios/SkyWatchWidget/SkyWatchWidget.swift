import WidgetKit
import SwiftUI
import Charts

// MARK: - Weather Data Models

struct WeatherEntry: TimelineEntry {
    let date: Date
    let temperature: String
    let timestamp: String
    let windSpeed: String
    let humidity: String
    let temperatureHistory: [Double]
    let isStale: Bool
}

struct WeatherData: Codable {
    let timestamp: String
    let temperature: String
    let dewpoint: String
    let humidity: String
    let pressure: String
    let windSpeed: String
    let peakGust: String
    let windDirection: String
    let rainfall: String
    let fetchedAt: String
}

// Wrapper for safe decoding
struct SafeWeatherData: Codable {
    let timestamp: String?
    let temperature: String?
    let dewpoint: String?
    let humidity: String?
    let pressure: String?
    let windSpeed: String?
    let peakGust: String?
    let windDirection: String?
    let rainfall: String?
    let fetchedAt: String?
    
    func toWeatherData() -> WeatherData? {
        guard let timestamp = timestamp,
              let temperature = temperature,
              let windSpeed = windSpeed,
              let humidity = humidity else {
            return nil // Missing critical fields
        }
        
        return WeatherData(
            timestamp: timestamp,
            temperature: temperature,
            dewpoint: dewpoint ?? "--",
            humidity: humidity,
            pressure: pressure ?? "--",
            windSpeed: windSpeed,
            peakGust: peakGust ?? "--",
            windDirection: windDirection ?? "--",
            rainfall: rainfall ?? "--",
            fetchedAt: fetchedAt ?? Date().ISO8601Format()
        )
    }
}

// MARK: - Timeline Provider

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> WeatherEntry {
        WeatherEntry(
            date: Date(),
            temperature: "LOAD", // Distinct placeholder text
            timestamp: "Waiting...",
            windSpeed: "--",
            humidity: "--",
            temperatureHistory: [],
            isStale: false
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (WeatherEntry) -> ()) {
        let entry = loadWeatherData()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let currentEntry = loadWeatherData()
        
        // Schedule next update in 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [currentEntry], policy: .after(nextUpdate))
        
        completion(timeline)
    }
    
    private func loadWeatherData() -> WeatherEntry {
        print("🔄 Widget: Attempting to load data...")
        
        var historyData: Data?
        
        // Method 1: Try reading from File System (Primary)
        if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.valdivia.skywatch.app") {
            let fileURL = containerURL.appendingPathComponent("weather_data.json")
            do {
                historyData = try Data(contentsOf: fileURL)
                print("✅ Widget: Loaded data from file system")
            } catch {
                print("⚠️ Widget: Could not read file: \(error)")
            }
        }
        
        // Method 2: Fallback to UserDefaults
        if historyData == nil {
            if let sharedDefaults = UserDefaults(suiteName: "group.com.valdivia.skywatch.app") {
                historyData = sharedDefaults.data(forKey: "weather_history")
                print(historyData != nil ? "✅ Widget: Loaded data from UserDefaults" : "⚠️ Widget: No data in UserDefaults")
            }
        }
        
        guard let finalData = historyData else {
            return emptyEntry(msg: "No Data")
        }
        
        do {
            let decoder = JSONDecoder()
            
            // Decode directly from Data (no String conversion needed)
            let history = try decoder.decode([SafeWeatherData].self, from: finalData)
            
            let validHistory = history.compactMap { $0.toWeatherData() }
            
            guard let latest = validHistory.last else {
                return emptyEntry(msg: "Empty")
            }
            
            print("✅ Widget: Successfully loaded! Temp: \(latest.temperature)°F")
            
            // Get last 12 temperatures for mini chart
            let recentHistory = validHistory.suffix(12)
            let temps = recentHistory.compactMap { Double($0.temperature) }
            
            return WeatherEntry(
                date: Date(),
                temperature: latest.temperature,
                timestamp: latest.timestamp,
                windSpeed: latest.windSpeed,
                humidity: latest.humidity,
                temperatureHistory: temps,
                isStale: false
            )
        } catch {
            print("❌ Widget: JSON Decode Error: \(error)")
            return emptyEntry(msg: "Bad JSON")
        }
    }
    
    private func emptyEntry(msg: String) -> WeatherEntry {
        return WeatherEntry(
            date: Date(),
            temperature: msg,
            timestamp: "Error",
            windSpeed: "--",
            humidity: "--",
            temperatureHistory: [],
            isStale: true
        )
    }
}

// MARK: - Widget Views

struct SkyWatchWidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemSmall:
            SmallWidgetView(entry: entry)
        default:
            MediumWidgetView(entry: entry)
        }
    }
}

struct SmallWidgetView: View {
    var entry: Provider.Entry
    
    var body: some View {
        // Background handled by container configuration
        VStack(alignment: .leading, spacing: 4) {
            // Cloud icon
                Image(systemName: "cloud.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.white)
                    .opacity(0.8)
                
                Spacer()
                
                // Temperature
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(entry.temperature)
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("°F")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.white.opacity(0.8))
                }
                
                // Timestamp
                Text(entry.timestamp)
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.7))
                
                if entry.isStale {
                    Text("⚠️ Stale")
                        .font(.system(size: 8))
                        .foregroundColor(.yellow)
                }
            }
            .padding()
        // Removed closing brace
    }
}

struct MediumWidgetView: View {
    var entry: Provider.Entry
    
    var body: some View {
        // ZStack removed - background handled by container
        HStack(spacing: 12) {
            // Left side - Current weather
            VStack(alignment: .leading, spacing: 6) {
                // Cloud icon
                Image(systemName: "cloud.fill")
                    .font(.system(size: 24))
                    .foregroundColor(Color(hex: "CFB87C"))
                
                Spacer()
                
                // Temperature
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(entry.temperature)
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.5) // Allow shrinking for error messages
                    Text("°F")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(.white.opacity(0.7))
                        .opacity(entry.temperature.contains(":") ? 0 : 1) // Hide °F for errors
                }
                
                // Stats
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Wind")
                            .font(.system(size: 9))
                            .foregroundColor(.white.opacity(0.6))
                        Text("\(entry.windSpeed) mph")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color(hex: "4A90E2"))
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Humid")
                            .font(.system(size: 9))
                            .foregroundColor(.white.opacity(0.6))
                        Text("\(entry.humidity)%")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color(hex: "22c55e"))
                    }
                }
                
                // Timestamp
                Text(entry.timestamp)
                    .font(.system(size: 9))
                    .foregroundColor(.white.opacity(0.5))
                
                if entry.isStale {
                    Text("⚠️ Data may be stale")
                        .font(.system(size: 8))
                        .foregroundColor(.yellow)
                }
            }
            .padding(.leading, 4)
            
            // Right side - Temperature trend
            VStack(alignment: .trailing, spacing: 4) {
                Text("Trend (12h)")
                    .font(.system(size: 9))
                    .foregroundColor(.white.opacity(0.6))
                
                if !entry.temperatureHistory.isEmpty {
                    MiniChartView(temperatures: entry.temperatureHistory)
                        .frame(height: 80)
                } else {
                    Text("No data")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.4))
                        .frame(height: 80)
                }
                
                Text("CU Boulder")
                    .font(.system(size: 9))
                    .foregroundColor(Color(hex: "CFB87C").opacity(0.8))
            }
            .padding(.trailing, 4)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity) // Force full width
    }
}

// MARK: - Mini Chart View

struct MiniChartView: View {
    let temperatures: [Double]
    
    var body: some View {
        GeometryReader { geometry in
            let minTemp = temperatures.min() ?? 0
            let maxTemp = temperatures.max() ?? 100
            let range = maxTemp - minTemp
            let adjustedRange = range == 0 ? 1 : range
            
            Path { path in
                for (index, temp) in temperatures.enumerated() {
                    let x = (CGFloat(index) / CGFloat(temperatures.count - 1)) * geometry.size.width
                    let normalizedY = (temp - minTemp) / adjustedRange
                    let y = geometry.size.height - (normalizedY * geometry.size.height)
                    
                    if index == 0 {
                        path.move(to: CGPoint(x: x, y: y))
                    } else {
                        path.addLine(to: CGPoint(x: x, y: y))
                    }
                }
            }
            .stroke(Color(hex: "CFB87C"), lineWidth: 2)
            
            // Fill area under line
            Path { path in
                for (index, temp) in temperatures.enumerated() {
                    let x = (CGFloat(index) / CGFloat(temperatures.count - 1)) * geometry.size.width
                    let normalizedY = (temp - minTemp) / adjustedRange
                    let y = geometry.size.height - (normalizedY * geometry.size.height)
                    
                    if index == 0 {
                        path.move(to: CGPoint(x: x, y: geometry.size.height))
                        path.addLine(to: CGPoint(x: x, y: y))
                    } else {
                        path.addLine(to: CGPoint(x: x, y: y))
                    }
                }
                path.addLine(to: CGPoint(x: geometry.size.width, y: geometry.size.height))
                path.closeSubpath()
            }
            .fill(LinearGradient(
                gradient: Gradient(colors: [Color(hex: "CFB87C").opacity(0.3), Color.clear]),
                startPoint: .top,
                endPoint: .bottom
            ))
        }
    }
}

// MARK: - Widget Configuration

@main
struct SkyWatchWidget: Widget {
    let kind: String = "SkyWatchWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                SkyWatchWidgetEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        // Use our custom background gradient here
                        LinearGradient(
                            gradient: Gradient(colors: [Color(hex: "1A1A1A"), Color(hex: "2A2A2A")]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    }
            } else {
                SkyWatchWidgetEntryView(entry: entry)
                    .background(LinearGradient(
                        gradient: Gradient(colors: [Color(hex: "1A1A1A"), Color(hex: "2A2A2A")]),
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
            }
        }
        .configurationDisplayName("Skywatch")
        .description("Current weather from CU Boulder ATOC station")
        .contentMarginsDisabled() // Important: Remove default margins!
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Preview

struct SkyWatchWidget_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            SkyWatchWidgetEntryView(entry: WeatherEntry(
                date: Date(),
                temperature: "42.7",
                timestamp: "1/26/26 5:00p",
                windSpeed: "7.0",
                humidity: "15",
                temperatureHistory: [40, 41, 42, 43, 44, 43, 42, 41, 42, 43, 42, 42.7],
                isStale: false
            ))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
            .previewDisplayName("Medium Widget")
            
            SkyWatchWidgetEntryView(entry: WeatherEntry(
                date: Date(),
                temperature: "42.7",
                timestamp: "1/26/26 5:00p",
                windSpeed: "7.0",
                humidity: "15",
                temperatureHistory: [],
                isStale: false
            ))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
            .previewDisplayName("Small Widget")
        }
    }
}
